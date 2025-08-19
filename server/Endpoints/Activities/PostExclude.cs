

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PostExclude : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/exclude", Handle)
            .WithSummary("Sets an activity to be excluded from the review process")
            .RequireAuthorization();
    }

    private static async Task<Ok> Handle(ExcludeActivityRequest request, [FromServices] IActivityService activityService)
    {
        await activityService.SetExclusionAsync(request.ActivityName, true);
        return TypedResults.Ok();
    }

    private record ExcludeActivityRequest(string ActivityName);
}
