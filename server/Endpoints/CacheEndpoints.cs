using RoleReaper.Services;

namespace RoleReaper.Endpoints;

public static class CacheEndpoints
{
    public static IEndpointRouteBuilder MapCache(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/cache/status", async (IRoleCache cache) =>
        {
            await cache.InitializeAsync();
            var ts = await cache.GetLastUpdatedAsync();
                    var roleCount = cache.GetAll().Count;
                    var actionCount = cache.GetActionPrivilegeMap().Count;
                    return Results.Ok(
                        new
                        {
                            lastUpdatedUtc = ts,
                            roleCount,
                            actionCount,
                        }
                    );
        }).RequireAuthorization();

        app.MapPost("/api/cache/refresh", async (IRoleCache cache) =>
        {
            await cache.RefreshAsync();
            var ts = await cache.GetLastUpdatedAsync();
            return Results.Ok(new { lastUpdatedUtc = ts });
        }).RequireAuthorization();

        return app;
    }
}
