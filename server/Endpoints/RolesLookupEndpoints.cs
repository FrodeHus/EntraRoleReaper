using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints;

public static class RolesLookupEndpoints
{
    public static IEndpointRouteBuilder MapRolesLookup(this IEndpointRouteBuilder app)
    {
        // Normalized role detail endpoint
        app.MapGet(
                "/api/roles/{id}",
                async (string id, [FromServices] IRoleService roleService) =>
                {
                    if (string.IsNullOrWhiteSpace(id))
                        return Results.BadRequest(new { message = "Missing id" });
                    var role = await roleService.GetRoleByIdAsync(id);
                    if (role == null)
                        return Results.NotFound(new { message = "Role not found" });
                    var grouped = role
                        .PermissionSets.Select(rp => new
                        {
                            condition = rp.Condition,
                            actions = (rp
                                    .ResourceActions ?? []).OrderBy(
                                    a => a.Action,
                                    StringComparer.OrdinalIgnoreCase
                                )
                                .Select(a => new { action = a.Action, privileged = a.IsPrivileged })
                                .ToList(),
                        })
                        .ToList();
                    
                    return Results.Ok(
                        new
                        {
                            id = role.Id,
                            displayName = role.DisplayName,
                            name = role.DisplayName,
                            description = role.Description,
                            rolePermissions = grouped,
                        }
                    );
                }
            )
            .RequireAuthorization();
        return app;
    }
}
