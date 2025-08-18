

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class DeleteActivityPropertyMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapDelete("/{activityId:guid}/property", Handle)
            .WithSummary("Deletes a property mapping from an activity")
            .RequireAuthorization();
    }

    private static async Task<Results<NoContent, BadRequest>> Handle(Guid activityId, DeleteActivityPropertyMappingRequest request, [FromServices] IActivityService activityService)
    {
        var activity = await activityService.GetActivityById(activityId);
        if (activity == null)
        {
            return TypedResults.BadRequest();
        }
        await activityService.DeletePropertyMapAsync(activity.Name, request.PropertyName);
        return TypedResults.NoContent();
    }

    private record DeleteActivityPropertyMappingRequest(string PropertyName);
}
