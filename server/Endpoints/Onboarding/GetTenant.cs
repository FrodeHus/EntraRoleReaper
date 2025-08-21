using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Onboarding;

public class GetTenant : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/", Handle)
            .WithSummary("Gets the tenant information")
            .RequireAuthorization();
    }

    private static async Task<Ok<TenantInformation>> Handle(HttpContext context, [FromServices] ITenantService tenantService)
    {
        var tenant = await tenantService.GetCurrentTenantAsync();
        var info = new TenantInformation(tenant?.Id, tenant?.Name, tenant?.TenantDomain, 0);
        
        return TypedResults.Ok(info);
    }
    
    private record TenantInformation(
        Guid? Id,
        string? Name,
        string? Domain,
        int CustomRoleCount
    );
}