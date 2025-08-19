

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Roles;

public class GetRoleSummary : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/summary", Handle)
            .WithSummary("Gets a summary of the roles")
            .RequireAuthorization();


    }

    private static async Task<Ok<SummaryResponse>> Handle(int? page,
            int? pageSize,
            string? search,
            bool? privilegedOnly,
            [FromServices] IRoleService roleService)
    {
        var p = page.GetValueOrDefault(1);
        var ps = pageSize.GetValueOrDefault(50);
        if (p < 1) p = 1;
        if (ps < 1) ps = 1;
        if (ps > 500) ps = 500;
        var roles = await roleService.SearchRolesAsync(search, privilegedOnly ?? false, ps);
        var roleDefinitions = roles.ToList();
        var total = roleDefinitions.Count();
        return TypedResults.Ok(new SummaryResponse(total, roleDefinitions));
    }

    private record SummaryResponse(int total, IEnumerable<RoleDefinitionDto> Roles);
}
