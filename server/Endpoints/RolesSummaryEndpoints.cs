using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Endpoints;

public static class RolesSummaryEndpoints
{
    public static IEndpointRouteBuilder MapRolesSummary(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/roles/summary", async (
            int? page,
            int? pageSize,
            string? sort,
            string? dir,
            string? search,
            bool? privilegedOnly,
            [FromServices] IRoleService roleService,
            HttpRequest req,
            HttpResponse res) =>
        {
            var p = page.GetValueOrDefault(1);
            var ps = pageSize.GetValueOrDefault(50);
            if (p < 1) p = 1;
            if (ps < 1) ps = 1;
            if (ps > 500) ps = 500;
            var roles = await roleService.SearchRolesAsync(search, privilegedOnly ?? false, ps);
            var roleDefinitions = roles.ToList();
            var total = roleDefinitions.Count();
            return Results.Ok(new { total, roles = roleDefinitions });
        }).RequireAuthorization();
        return app;
    }
}
