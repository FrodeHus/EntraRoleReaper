using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Cache;

public class PostRefresh : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/api/cache/refresh", Handle)
            .WithSummary("Refreshes the cache")
            .RequireAuthorization();
    }

    private static async Task<Ok<CacheMetadataResponse>> Handle([FromServices] ICacheService cacheService)
    {
        await cacheService.InitializeAsync(true);
        var metadata = cacheService.GetCacheMetadata();

        return TypedResults.Ok(
            new CacheMetadataResponse(
                metadata.LastUpdated,
                metadata.RoleCount,
                metadata.ResourceActionCount
            )
        );
    }
}