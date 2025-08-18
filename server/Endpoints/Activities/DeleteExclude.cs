

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class DeleteExclude : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapDelete("/exclude/{id}", Handle)
            .WithSummary("Deletes an exclusion from the activity log")
            .RequireAuthorization();
    }

    private static async Task<NoContent> Handle(string operationName, [FromServices] IActivityService activityService)
    {
        await activityService.SetExclusionAsync(operationName, false);
        return TypedResults.NoContent();
    }
}
