

using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.TargetResources;

public class GetTargetResourceByActivity : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/{activityId:guid}/targetresource", Handle)
            .WithSummary("Gets target resources by activity ID")
            .RequireAuthorization();
    }

    private static async Task<Ok<List<TargetResourceDto?>>> Handle(Guid activityId, [FromServices] IActivityService activityService)
    {
        var activity = await activityService.GetActivityById(activityId);
        if (activity == null)
        {
            return TypedResults.Ok(new List<TargetResourceDto?>());
        }
        var targetResources = activity.TargetResources;
        var dtos = targetResources?.Select(TargetResourceDto.FromTargetResource).ToList() ?? [];
        return TypedResults.Ok(dtos);
    }
}
