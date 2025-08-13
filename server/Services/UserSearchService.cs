using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services;

public class UserSearchService(IGraphServiceFactory factory) : IUserSearchService
{
    public async Task<IEnumerable<DirectoryItem>> SearchAsync(string query, bool includeGroups)
    {
        var graph = await factory.CreateForUserAsync();

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
