

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PutActivityTargetResourcePropertyMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPut("/targetresourceproperty", Handle)
            .WithSummary("Updates the mapping of an activity to a specific target resource property")
            .RequireAuthorization();
    }

    private static async Task<Results<Created,BadRequest<string>>> Handle(ActivityTargetResourcePropertyMappingRequest request, [FromServices] IActivityService activityService)
    {
        foreach(var targetResourceProperty in request.TargetResourcePropertyIds ?? [])
        {
            foreach(var resourceActionId in request.ResourceActionIds ?? [])
            {
                await activityService.MapActivityToTargetResourcePropertyAsync(targetResourceProperty, resourceActionId);
            }
        }

        return TypedResults.Created();
    }

    private record class ActivityTargetResourcePropertyMappingRequest(Guid[] TargetResourcePropertyIds, Guid[] ResourceActionIds);
}
