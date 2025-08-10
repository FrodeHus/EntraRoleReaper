using System.Globalization;
using System.Text.Json;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace EntraRoleAssignmentAuditor.Services;

public record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);

public record ReviewTarget(string? Id, string? DisplayName, string? Type, string? Label);

public record PermissionDetail(string Name, bool Privileged);

public record ReviewOperation(
    string Operation,
    string[] RequiredPermissions,
    IReadOnlyList<ReviewTarget> Targets,
    IReadOnlyList<PermissionDetail> PermissionDetails
);

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

public class ReviewService(IGraphServiceFactory factory, IRoleCache roleCache) : IReviewService
{
    private readonly Lazy<Dictionary<string, string[]>> _permissionMap = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "permissions-map.json");
        if (File.Exists(path))
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<Dictionary<string, string[]>>(json) ?? [];
        }
        return [];
    });

    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var graphClient = await factory.CreateForUserAsync();

        // Expand groups to users
        var userIds = new HashSet<string>();
        foreach (var id in request.UsersOrGroups.Distinct())
        {
            if (id.StartsWith("group:"))
            {
                var groupId = id[6..];
                var members = await graphClient.Groups[groupId].Members.GetAsync();
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
        var actionPrivilege = roleCache.GetActionPrivilegeMap();
        var roleStats = roleCache.GetRolePrivilegeStats();

        foreach (var uid in userIds)
        {
            var user = await graphClient.Users[uid].GetAsync();
            var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;

            // Get current directory roles for the user via memberOf (DirectoryRole)
            var currentRoleIds = new List<string>();
            var memberships = await graphClient.Users[uid].MemberOf.GetAsync();
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
            // Collect per-operation target details (unique by type+id)
            var opTargets = new Dictionary<string, Dictionary<string, ReviewTarget>>(
                StringComparer.OrdinalIgnoreCase
            );
            var audits = await graphClient.AuditLogs.DirectoryAudits.GetAsync(q =>
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

                        // Capture target resources per operation
                        if (a.TargetResources != null && a.TargetResources.Any())
                        {
                            if (!opTargets.TryGetValue(a.ActivityDisplayName, out var targetsForOp))
                            {
                                targetsForOp = new Dictionary<string, ReviewTarget>(
                                    StringComparer.OrdinalIgnoreCase
                                );
                                opTargets[a.ActivityDisplayName] = targetsForOp;
                            }

                            foreach (var tr in a.TargetResources)
                            {
                                var key =
                                    $"{tr?.Type ?? ""}:{tr?.Id ?? tr?.DisplayName ?? Guid.NewGuid().ToString()}";
                                if (!targetsForOp.ContainsKey(key))
                                {
                                    targetsForOp[key] = new ReviewTarget(
                                        tr?.Id,
                                        tr?.DisplayName,
                                        tr?.Type,
                                        FriendlyType(tr?.Type)
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // Map operations to required permissions via static map (extendable)
            var operationsList = usedOperations
                .Select(op =>
                {
                    var perms = _permissionMap.Value.TryGetValue(op, out var p) ? p : [];
                    var targets = opTargets.TryGetValue(op, out var t)
                        ? [.. t.Values]
                        : new List<ReviewTarget>();
                    var details = perms
                        .Select(name => new PermissionDetail(
                            name,
                            actionPrivilege.TryGetValue(name, out var isPriv) && isPriv
                        ))
                        .ToList();
                    return new ReviewOperation(op, perms, targets, details);
                })
                .ToList();

            var requiredPermissions = operationsList
                .SelectMany(op => op.RequiredPermissions)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            // Suggest roles that cover all required permissions, preferring fewer privileged actions
            int usedPrivRequired = requiredPermissions.Count(p =>
                actionPrivilege.TryGetValue(p, out var b) && b
            );

            var suggested = roles
                .Values.Where(r =>
                    r.RolePermissions != null
                    && r.RolePermissions.Any()
                    && requiredPermissions.All(p =>
                        r.RolePermissions!.Any(rp =>
                            (rp.AllowedResourceActions ?? new List<string>()).Any(a =>
                                string.Equals(a, p, StringComparison.OrdinalIgnoreCase)
                            )
                        )
                    )
                )
                .Select(r => new
                {
                    Role = r,
                    Stats = (r.Id != null && roleStats.TryGetValue(r.Id, out var rs))
                        ? rs
                        : new RolePrivilegeStats(
                            PrivilegedAllowed: 0,
                            TotalAllowed: (
                                r.RolePermissions ?? new List<UnifiedRolePermission>()
                            ).Sum(rp => (rp.AllowedResourceActions ?? new List<string>()).Count)
                        ),
                })
                .OrderBy(x => Math.Max(0, x.Stats.PrivilegedAllowed - usedPrivRequired)) // extra privileged beyond required
                .ThenBy(x => x.Stats.PrivilegedAllowed) // overall privileged in role
                .ThenBy(x => x.Stats.TotalAllowed) // smaller roles preferred
                .ThenBy(x => x.Role.DisplayName)
                .Select(x => x.Role.DisplayName!)
                .Take(5)
                .ToArray();

            results.Add(
                new UserReview(
                    uid,
                    display,
                    [.. currentRoleIds.Distinct()],
                    [.. usedOperations],
                    suggested,
                    operationsList.Count,
                    operationsList
                )
            );
        }

        return new ReviewResponse(results);
    }

    private static string? FriendlyType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type))
            return null;
        var t = type.Trim();
        switch (t.ToLowerInvariant())
        {
            case "user":
                return "User";
            case "group":
                return "Group";
            case "directoryrole":
                return "Directory role";
            case "roledefinition":
                return "Role definition";
            case "serviceprincipal":
                return "App (service principal)";
            case "application":
                return "App (application)";
            case "device":
                return "Device";
            case "policy":
                return "Policy";
            case "approleassignment":
                return "App role assignment";
            case "oauth2permissiongrant":
                return "OAuth permission grant";
            case "directorysetting":
                return "Directory setting";
            default:
                // Title-case the original type as a fallback
                return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(t);
        }
    }
}
