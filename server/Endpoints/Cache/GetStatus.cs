using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Cache;

public class GetStatus : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/status", Handle)
            .WithSummary("Gets the status of the cache")
            .RequireAuthorization();
    }

    private static async Task<Ok<CacheMetadataResponse>> Handle([FromServices] ICacheService cacheService)
    {
        await cacheService.InitializeAsync();
        var metadata = cacheService.GetCacheMetadata();

        return TypedResults.Ok(
            new CacheMetadataResponse
            (
                metadata.LastUpdated,
                metadata.RoleCount,
                metadata.ResourceActionCount
            )
        );
    }
}