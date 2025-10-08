using EntraRoleReaper.Api.Services;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Roles;

[UsedImplicitly]
public class GetRole : IEndpoint
{

    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/{id:guid}", Handle)
            .WithSummary("Get role definition by ID")
            .WithName(nameof(GetRole))
            .RequireAuthorization();
    }
    
    private static async Task<Results<Ok<RoleResponse>, BadRequest, NotFound>> Handle(Guid id,
        [FromServices] IRoleService roleService)
    {
        if (string.IsNullOrWhiteSpace(id.ToString()))
            return TypedResults.BadRequest();
        var role = await roleService.GetRoleByIdAsync(id);
        if (role == null)
            return TypedResults.NotFound();

        var grouped = role
            .PermissionSets.Select(rp => new
                RolePermissionSetResponse(
                rp.Condition,
                (rp
                        .ResourceActions ?? []).OrderBy(
                        a => a.Action,
                        StringComparer.OrdinalIgnoreCase
                    )
                    .Select(a => new RolePermissionActionResponse(a.Id, a.Action, a.Description, a.IsPrivileged))
                    .ToList())
            ).ToList();

        return TypedResults.Ok(
            new RoleResponse
            (
                role.Id,
                role.DisplayName,
                role.Description,
                grouped
            )
        );
    }

    private record RoleResponse(
        Guid Id,
        string DisplayName,
        string Description,
        List<RolePermissionSetResponse> RolePermissions
    );

    private record RolePermissionSetResponse(
        string? Condition,
        List<RolePermissionActionResponse> Actions
    );

    private record RolePermissionActionResponse(
        Guid Id,
        string Action,
        string? Description,
        bool Privileged
    );
}