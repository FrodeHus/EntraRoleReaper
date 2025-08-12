using RoleReaper.Services;

namespace RoleReaper.Endpoints;

public static class SearchEndpoints
{
    public static IEndpointRouteBuilder MapSearch(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/search", async (string q, bool includeGroups, IUserSearchService svc) =>
        {
            var results = await svc.SearchAsync(q, includeGroups);
            return Results.Ok(results);
        }).RequireAuthorization();
        return app;
    }
}
