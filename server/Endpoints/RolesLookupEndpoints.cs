using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Endpoints;

public static class RolesLookupEndpoints
{
    public static IEndpointRouteBuilder MapRolesLookup(this IEndpointRouteBuilder app)
    {
        // Batch resolve role ids to display names (legacy cache-based)
        app.MapPost(
                "/api/roles/names",
                async (string[] ids, IRoleCache cache) =>
                {
                    await cache.InitializeAsync();
                    var roles = cache.GetAll();
                    var unique = ids.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                    var result = unique
                        .Select(id => new
                        {
                            id,
                            name = roles.TryGetValue(id, out var def)
                                ? def.DisplayName ?? string.Empty
                                : string.Empty,
                        })
                        .ToList();
                    return Results.Ok(result);
                }
            )
            .RequireAuthorization();

        // Normalized role detail endpoint
        app.MapGet(
                "/api/roles/{id}",
                async (string id, CacheDbContext db) =>
                {
                    if (string.IsNullOrWhiteSpace(id))
                        return Results.BadRequest(new { message = "Missing id" });
                    var role = await db
                        .RoleDefinitions.Include(r => r.RolePermissions)
                        .ThenInclude(rp => rp.ResourceActions)
                        .FirstOrDefaultAsync(r => r.Id == id);
                    if (role == null)
                        return Results.NotFound(new { message = "Role not found" });
                    var grouped = role
                        .RolePermissions.Select(rp => new
                        {
                            condition = rp.Condition,
                            actions = rp
                                .ResourceActions.OrderBy(
                                    a => a.Action,
                                    StringComparer.OrdinalIgnoreCase
                                )
                                .Select(a => new { action = a.Action, privileged = a.IsPrivileged })
                                .ToList(),
                        })
                        .ToList();
                    var scopes = new List<string>();
                    if (!string.IsNullOrWhiteSpace(role.ResourceScope))
                        scopes.Add(role.ResourceScope!);
                    static string DescribeScope(string s)
                    {
                        if (string.IsNullOrWhiteSpace(s))
                            return "Unknown";
                        if (s == "/")
                            return "Tenant-wide";
                        string norm = s.Trim();
                        if (
                            norm.StartsWith(
                                "/administrativeUnits/",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                            return "Administrative Unit scope";
                        if (norm.StartsWith("/groups/", StringComparison.OrdinalIgnoreCase))
                            return "Group scope";
                        if (norm.StartsWith("/users/", StringComparison.OrdinalIgnoreCase))
                            return "User scope";
                        if (norm.StartsWith("/devices/", StringComparison.OrdinalIgnoreCase))
                            return "Device scope";
                        if (norm.StartsWith("/applications/", StringComparison.OrdinalIgnoreCase))
                            return "Application scope";
                        if (
                            norm.StartsWith(
                                "/servicePrincipals/",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                            return "Service principal scope";
                        if (
                            norm.StartsWith(
                                "/directoryObjects/",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                            return "Directory object scope";
                        return $"Resource scope ({s})";
                    }
                    var scopeDetails = scopes
                        .Select(s => new { value = s, description = DescribeScope(s) })
                        .ToList();
                    return Results.Ok(
                        new
                        {
                            id = role.Id,
                            displayName = role.DisplayName,
                            name = role.DisplayName,
                            description = role.Description,
                            resourceScopes = scopes,
                            resourceScopesDetailed = scopeDetails,
                            rolePermissions = grouped,
                        }
                    );
                }
            )
            .RequireAuthorization();
        return app;
    }
}
