

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Roles.Repositories;
using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PutActivityMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPut("/", Handle)
            .WithSummary("Updates the mapping of an activity to a specific resource action")
            .RequireAuthorization();
    }

    private static async Task<Results<Created, BadRequest>> Handle(ActivityMappingRequest request, [FromServices] IActivityService activityService, [FromServices] IResourceActionRepository resourceActionRepository)
    {
        var dIds = request.ResourceActionIds?.Distinct().ToArray() ?? [];

        await activityService.MapResourceActionsToActivity(dIds, request.ActivityId);
        return TypedResults.Created();
    }

    private record ActivityMappingRequest(Guid ActivityId, Guid[] ResourceActionIds);
}
