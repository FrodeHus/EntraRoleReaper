using System.Text.Json;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace EntraRoleAuditor.Services;

public record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);

public record ReviewOperation(string Operation, string[] RequiredPermissions);

public record UserReview(
    string UserId,
    string UserDisplayName,
    string[] CurrentRoleIds,
    string[] UsedOperations,
    string[] SuggestedRoleIds,
    int OperationCount,
    IReadOnlyList<ReviewOperation> Operations
);

public record ReviewResponse(List<UserReview> Results);

public interface IReviewService
{
    Task<ReviewResponse> ReviewAsync(ReviewRequest request);
}

public class ReviewService(
    IGraphServiceFactory factory,
    IRoleCache roleCache,
    IHttpContextAccessor accessor,
    IConfiguration config
) : IReviewService
{
    private readonly Lazy<Dictionary<string, string[]>> _permissionMap = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "permissions-map.json");
        if (File.Exists(path))
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<Dictionary<string, string[]>>(json) ?? new();
        }
        return new();
    });

    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var token = accessor
            .HttpContext?.Request.Headers["Authorization"]
            .ToString()
            ?.Replace("Bearer ", "");
        if (string.IsNullOrEmpty(token))
            throw new UnauthorizedAccessException();
        var graph = await factory.CreateForUserAsync(token);

        // Expand groups to users
        var userIds = new HashSet<string>();
        foreach (var id in request.UsersOrGroups.Distinct())
        {
            if (id.StartsWith("group:"))
            {
                var groupId = id[6..];
                var members = await graph.Groups[groupId].Members.GetAsync();
                if (members?.Value != null)
                {
                    foreach (var m in members.Value.OfType<User>())
                    {
                        if (!string.IsNullOrEmpty(m.Id))
                            userIds.Add(m.Id);
                    }
                }
            }
            else
            {
                userIds.Add(id.Replace("user:", string.Empty));
            }
        }

        var results = new List<UserReview>();
        await roleCache.InitializeAsync();
        var roles = roleCache.GetAll();

        foreach (var uid in userIds)
        {
            var user = await graph.Users[uid].GetAsync();
            var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;

            // Get current directory roles for the user via memberOf (DirectoryRole)
            var currentRoleIds = new List<string>();
            var memberships = await graph.Users[uid].MemberOf.GetAsync();
            if (memberships?.Value != null)
            {
                foreach (var mo in memberships.Value.OfType<DirectoryRole>())
                {
                    var templateId = mo.RoleTemplateId;
                    if (!string.IsNullOrEmpty(templateId))
                    {
                        // Map templateId to unified role definition id
                        var match = roles.Values.FirstOrDefault(r =>
                            string.Equals(
                                r.TemplateId,
                                templateId,
                                StringComparison.OrdinalIgnoreCase
                            )
                        );
                        if (match?.Id != null)
                            currentRoleIds.Add(match.Id);
                    }
                }
            }

            // Audit logs: directory audits filtered by user and time
            var usedOperations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var audits = await graph.AuditLogs.DirectoryAudits.GetAsync(q =>
            {
                q.QueryParameters.Filter =
                    $"activityDateTime ge {request.From:O} and activityDateTime le {request.To:O} and initiatedBy/user/id eq '{uid}'";
                q.QueryParameters.Top = 100;
            });
            if (audits?.Value != null)
            {
                foreach (var a in audits.Value)
                {
                    if (!string.IsNullOrWhiteSpace(a.ActivityDisplayName))
                    {
                        usedOperations.Add(a.ActivityDisplayName);
                    }
                }
            }

            // Map operations to required permissions via static map (extendable)
            var operationsList = usedOperations
                .Select(op => new ReviewOperation(
                    op,
                    _permissionMap.Value.TryGetValue(op, out var perms)
                        ? perms
                        : Array.Empty<string>()
                ))
                .ToList();

            var requiredPermissions = operationsList
                .SelectMany(op => op.RequiredPermissions)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            // Suggest least-privilege role IDs (very naive heuristic using role permissions contains all required perms)
            var suggested = roles
                .Values.Where(r =>
                    r.RolePermissions != null
                    && r.RolePermissions!.Any()
                    && requiredPermissions.All(p =>
                        r.RolePermissions!.Any(rp =>
                            (rp.AllowedResourceActions ?? new List<string>()).Any(a =>
                                string.Equals(a, p, StringComparison.OrdinalIgnoreCase)
                            )
                        )
                    )
                )
                .Select(r => r.DisplayName!)
                .Take(5)
                .ToArray();

            results.Add(
                new UserReview(
                    uid,
                    display,
                    currentRoleIds.Distinct().ToArray(),
                    usedOperations.ToArray(),
                    suggested,
                    operationsList.Count,
                    operationsList
                )
            );
        }

        return new ReviewResponse(results);
    }
}
