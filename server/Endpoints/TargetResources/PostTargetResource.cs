

using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.TargetResources;

public class PostTargetResource : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/target", Handle).WithSummary("Creates a new target resource").RequireAuthorization();
    }

    private static async Task<Results<Ok, BadRequest<string>>> Handle([FromBody] PostTargetResourceRequest request, [FromServices] IActivityService activityService)
    {
        var existing = await activityService.GetTargetResourceByType(request.TargetResource.ResourceType);
        if (existing != null)
        {
            return TypedResults.BadRequest("Already exists");
        }

        await activityService.AddTargetResourceAsync(request.TargetResource);
        return TypedResults.Ok();
    }
    private record PostTargetResourceRequest(TargetResourceDto TargetResource);
}

