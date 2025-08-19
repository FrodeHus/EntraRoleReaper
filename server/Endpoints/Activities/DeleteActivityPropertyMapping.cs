

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class DeleteActivityPropertyMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapDelete("/property", Handle)
            .WithSummary("Deletes a property mapping from an activity")
            .RequireAuthorization();
    }

    private static async Task<Results<NoContent, BadRequest>> Handle([FromBody] DeleteActivityPropertyMappingRequest request, [FromServices] IActivityService activityService)
    {
        await activityService.DeletePropertyMapAsync(request.ActivityName, request.PropertyName);
        return TypedResults.NoContent();
    }

    private record DeleteActivityPropertyMappingRequest(string ActivityName, string PropertyName);
}
