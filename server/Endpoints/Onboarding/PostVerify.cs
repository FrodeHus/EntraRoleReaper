using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Onboarding;

public class PostVerify : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/verify", Handle)
            .WithSummary("Verifies the onboarding process")
            .RequireAuthorization();
    }

    private static async Task<Results<Ok<TenantVerificationResponse>, ProblemHttpResult>> Handle(
        [FromServices] ITenantService tenantService)
    {
        var tenant = await tenantService.GetCurrentTenantAsync(refresh: true);
        if (tenant is null)
        {
            return TypedResults.Problem(
                title: "No tenant",
                detail: "Unable to resolve or fetch tenant metadata.",
                statusCode: 404
            );
        }

        return TypedResults.Ok(
            new TenantVerificationResponse(
                tenant.Id,
                tenant.Name ?? "(no name)",
                tenant.TenantDomain ?? "(no primary domain)"
            )
        );
    }

    private record TenantVerificationResponse(Guid TenantId, string Name, string Domain);
}