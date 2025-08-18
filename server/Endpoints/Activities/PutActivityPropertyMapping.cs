

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PutActivityPropertyMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPut("/activity/property", Handle)
            .WithSummary("Updates the property mapping for an activity")
            .RequireAuthorization();
    }

    private static async Task<Results<Ok, BadRequest<string>>> Handle(Guid activityId, [FromBody] PutActivityPropertyMappingRequest request, IActivityService activityService)
    {
        if (activityId == Guid.Empty || string.IsNullOrWhiteSpace(request.PropertyName) || request.ResourceActionIds == null || request.ResourceActionIds.Length == 0)
        {
            return TypedResults.BadRequest("Missing values");
        }

        await activityService.AddPropertyMapToActivityAsync(request.ActivityName, request.PropertyName, request.ResourceActionIds);
        return TypedResults.Ok();
    }

    private record PutActivityPropertyMappingRequest(string ActivityName, string PropertyName, Guid[] ResourceActionIds);
}
