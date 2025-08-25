using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class GetAllActivities : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/", Handle)
            .WithSummary("Gets all activities")
            .RequireAuthorization();
    }

    private static async Task<Ok<IEnumerable<ActivityDto>>> Handle([FromServices] IActivityService activityService)
    {
        var activities = await activityService.GetActivitiesAsync();
        var dtos = activities?.Select(a => ActivityDto.FromActivity(a));
        return TypedResults.Ok(dtos);
    }
}