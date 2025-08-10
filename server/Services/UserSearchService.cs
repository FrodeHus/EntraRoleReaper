using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace EntraRoleAuditor.Services;

public record DirectoryItem(string Id, string DisplayName, string Type);

public interface IUserSearchService
{
    Task<IEnumerable<DirectoryItem>> SearchAsync(string query, bool includeGroups);
}

public class UserSearchService(IGraphServiceFactory factory, IHttpContextAccessor accessor)
    : IUserSearchService
{
    public async Task<IEnumerable<DirectoryItem>> SearchAsync(string query, bool includeGroups)
    {
        var token = accessor
            .HttpContext?.Request.Headers.Authorization.ToString()
            ?.Replace("Bearer ", "");
        if (string.IsNullOrEmpty(token))
            throw new UnauthorizedAccessException();
        var graph = await factory.CreateForUserAsync(token);

        var items = new List<DirectoryItem>();

        // Users
        var users = await graph.Users.GetAsync(req =>
        {
            req.QueryParameters.Search =
                $"\"displayName:{query}\" OR \"mail:{query}\" OR \"userPrincipalName:{query}\"";
            req.QueryParameters.Top = 25;
            req.Headers.Add("ConsistencyLevel", "eventual");
        });
        if (users?.Value != null)
        {
            items.AddRange(
                users.Value.Select(u => new DirectoryItem(
                    u.Id!,
                    u.DisplayName ?? u.UserPrincipalName ?? "(no name)",
                    "user"
                ))
            );
        }

        if (includeGroups)
        {
            var groups = await graph.Groups.GetAsync(req =>
            {
                req.QueryParameters.Search = $"\"displayName:{query}\"";
                req.QueryParameters.Top = 25;
                req.Headers.Add("ConsistencyLevel", "eventual");
            });
            if (groups?.Value != null)
            {
                items.AddRange(
                    groups.Value.Select(g => new DirectoryItem(
                        g.Id!,
                        g.DisplayName ?? "(group)",
                        "group"
                    ))
                );
            }
        }

        return items;
    }
}
