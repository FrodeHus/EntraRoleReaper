using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace EntraRoleReaper.Api.Endpoints;

public static class OnboardingEndpoints
{
    public static IEndpointRouteBuilder MapOnboarding(this IEndpointRouteBuilder app)
    {
        var grp = app.MapGroup("/api/onboarding").RequireAuthorization();

        grp.MapPost(
            "/verify",
            async (ITenantService tenantService, CancellationToken ct) =>
            {
                var tenant = await tenantService.GetCurrentTenantAsync(refresh: true, ct: ct);
                if (tenant is null)
                {
                    return Results.Problem(
                        title: "No tenant",
                        detail: "Unable to resolve or fetch tenant metadata.",
                        statusCode: 404
                    );
                }
                return Results.Ok(
                    new
                    {
                        tenantId = tenant.Id,
                        name = tenant.Name,
                        domain = tenant.TenantDomain,
                    }
                );
            }
        );

        return app;
    }
}
