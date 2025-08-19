

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class GetActivityMapping : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/mapping/{operationName}", Handle)
            .WithSummary("Gets the activity mapping")
            .RequireAuthorization();
    }

    private static async Task<Results<Ok<ActivityMappingResponse>, BadRequest>> Handle(
        string operationName,
        [FromServices] IActivityRepository activityRepository,
        [FromServices] IResourceActionRepository resourceActionRepository)
    {
        if (string.IsNullOrWhiteSpace(operationName))
            return TypedResults.BadRequest();
        var activities = await activityRepository.GetByNameAsync(operationName);
        var allActions = await resourceActionRepository.GetAllAsync();
        return TypedResults.Ok(
            new ActivityMappingResponse
            (
                operationName,
                activities?.MappedResourceActions?.Select(a => a.Action) ?? [],
                allActions
        ));
    }
    private record class ActivityMappingResponse(
        string OperationName,
        IEnumerable<string> MappedActions,
        IEnumerable<ResourceActionDto> AllActions
    );
    private record ActivityMappingRequest(string ActivityName);
}
