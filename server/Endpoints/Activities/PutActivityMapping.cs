

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PutActivityMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPut("/mapping", Handle)
            .WithSummary("Updates the mapping of an activity to a specific resource action")
            .RequireAuthorization();
    }

    private static async Task<Results<Created, BadRequest>> Handle(ActivityMappingRequest request, [FromServices] IActivityRepository activityRepository, [FromServices] IResourceActionRepository resourceActionRepository)
    {
        if (string.IsNullOrWhiteSpace(request.ActivityName))
            return TypedResults.BadRequest();
        var dIds = request.ResourceActionIds?.Distinct().ToArray() ?? [];
        await activityRepository.AddAsync(new Activity
        {
            Name = request.ActivityName.Trim(),
            MappedResourceActions = await resourceActionRepository
                .GetResourceActionsByIdsAsync(dIds),
        });
        return TypedResults.Created();
    }

    private record ActivityMappingRequest(string ActivityName, Guid[] ResourceActionIds);
}
