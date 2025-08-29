using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class GetExcludedActivities : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/exclude", Handle)
            .WithSummary("Gets the list of excluded activities")
            .RequireAuthorization();
    }

    private static async Task<Ok<IEnumerable<Activity>>> Handle([FromServices] IActivityService activityService)
    {
        var excludedActivities = await activityService.GetExcludedActivitiesAsync();
        return TypedResults.Ok(excludedActivities);
    }
}
