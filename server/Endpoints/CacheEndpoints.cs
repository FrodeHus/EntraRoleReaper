using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints;

public static class CacheEndpoints
{
    public static IEndpointRouteBuilder MapCache(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/cache/status", async ([FromServices] ICacheService cache) =>
        {
            await cache.InitializeAsync();
            var metadata = cache.GetCacheMetadata();
            
            return Results.Ok(
                new
                {
                    lastUpdatedUtc = metadata.LastUpdated,
                    roleCount = metadata.RoleCount,
                    actionCount = metadata.ResourceActionCount,
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