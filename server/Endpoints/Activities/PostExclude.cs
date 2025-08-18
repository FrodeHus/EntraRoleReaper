

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PostExclude : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/exclude", Handle)
            .WithSummary("Excludes an acitivity from the activity log")
            .RequireAuthorization();
    }

    private static async Task<Ok> Handle(ExcludeActivityRequest request, [FromServices] IActivityService activityService)
    {
        await activityService.SetExclusionAsync(request.ActivityName, true);
        return TypedResults.Ok();
    }

    public record ExcludeActivityRequest(string ActivityName);
}
