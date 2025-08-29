using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Onboarding;

public class GetVerifyAccess : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder
            .MapGet("/access", Handle)
            .WithSummary("Verifies the signed-in user has required directory role permissions")
            .RequireAuthorization();
    }

    private static async Task<Results<Ok<AccessVerificationResponse>, ProblemHttpResult>> Handle(
        ClaimsPrincipal user,
        IConfiguration config,
        [FromServices] IGraphService graphService,
        [FromServices] IRoleService roleService,
        ILogger<GetVerifyAccess> logger
    )
    {
        var uid = GetUserObjectId(user);
        if (string.IsNullOrWhiteSpace(uid))
        {
            return TypedResults.Problem(
                title: "Missing user identifier",
                detail: "Could not resolve user object id (oid)",
                statusCode: 400
            );
        }

        // Required role names can be configured in appsettings: Onboarding:RequiredRoleNames
        var requiredRoleNames =
            config.GetSection("Onboarding:RequiredRoleNames").Get<string[]>()
            ?? new[]
            {
                "Security Reader",
                "Global Administrator",
                "Security Administrator",
                "Global Reader",
            };

        try
        {
            var (displayName, activeRoleIds, eligibleRoleIds, pimActiveRoleIds) =
                await graphService.GetUserAndRolesAsync(uid);
            // Active = permanent assignments + currently activated PIM assignments
            var activeIds = new HashSet<string>(
                activeRoleIds ?? [],
                StringComparer.OrdinalIgnoreCase
            );
            foreach (var id in pimActiveRoleIds ?? [])
                activeIds.Add(id);

            // Resolve role display names
            var activeRoles = new List<RoleDefinitionDto>();
            var eligibleRoles = new List<RoleDefinitionDto>();
            foreach (var id in activeIds)
            {
                if (!Guid.TryParse(id, out var guid))
                    continue;
                var role = await roleService.GetRoleByIdAsync(guid);
                if (role != null)
                    activeRoles.Add(role);
            }

            // Resolve eligible roles (may overlap with active)
            foreach (var id in eligibleRoleIds ?? [])
            {
                if (!Guid.TryParse(id, out var guid))
                    continue;
                var role = await roleService.GetRoleByIdAsync(guid);
                if (role != null)
                    eligibleRoles.Add(role);
            }

            // Determine access: if user holds any of the required role names
            var activeRoleNames = new HashSet<string>(
                activeRoles.Select(r => r.DisplayName),
                StringComparer.OrdinalIgnoreCase
            );
            var hasAccess = requiredRoleNames.Any(rn => activeRoleNames.Contains(rn));
            var missing = requiredRoleNames.Where(rn => !activeRoleNames.Contains(rn)).ToArray();

            var response = new AccessVerificationResponse(
                hasAccess,
                displayName,
                activeRoles
                    .Select(r => new SimpleRole(r.Id, r.DisplayName, r.IsPrivileged))
                    .ToList(),
                eligibleRoles
                    .Select(r => new SimpleRole(r.Id, r.DisplayName, r.IsPrivileged))
                    .ToList(),
                requiredRoleNames,
                missing
            );

            return TypedResults.Ok(response);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed verifying access for current user");
            return TypedResults.Problem(
                title: "Verification failed",
                detail: ex.Message,
                statusCode: 500
            );
        }
    }

    private static string? GetUserObjectId(ClaimsPrincipal user)
    {
        // Try common claim types used by Entra ID
        return user.FindFirstValue("oid")
            ?? user.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier")
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub");
    }

    public record SimpleRole(Guid Id, string Name, bool IsPrivileged);

    public record AccessVerificationResponse(
        bool HasAccess,
        string UserDisplayName,
        List<SimpleRole> ActiveRoles,
        List<SimpleRole> EligibleRoles,
        IEnumerable<string> RequiredRoleNames,
        IEnumerable<string> MissingRoleNames
    );
}
