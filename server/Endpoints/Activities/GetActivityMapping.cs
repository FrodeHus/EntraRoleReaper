

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Repositories;
using EntraRoleReaper.Api.Modules.Entra.Roles.Repositories;
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
        [FromQuery(Name = "q")] string? q,
        [FromQuery(Name = "namespace")] string? @namespace,
        [FromQuery] string? namespaces,
        [FromQuery] string? resourceGroups,
        [FromQuery] bool? priv,
        [FromServices] IActivityRepository activityRepository,
        [FromServices] IResourceActionRepository resourceActionRepository)
    {
        if (string.IsNullOrWhiteSpace(operationName))
            return TypedResults.BadRequest();
        var activities = await activityRepository.GetByNameAsync(operationName);
        // Build optional filters
        List<string>? nsFilter = null;
        if (!string.IsNullOrWhiteSpace(@namespace))
        {
            nsFilter = [@namespace!];
        }
        else if (!string.IsNullOrWhiteSpace(namespaces))
        {
            nsFilter = namespaces!
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }
        List<string>? rgFilter = null;
        if (!string.IsNullOrWhiteSpace(resourceGroups))
        {
            rgFilter = resourceGroups!
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }
        var allActions =
            (nsFilter is null && rgFilter is null && priv is null && string.IsNullOrWhiteSpace(q))
                ? await resourceActionRepository.GetAllAsync()
                : await resourceActionRepository.SearchResourceActionsAsync(
                    q,
                    nsFilter,
                    rgFilter,
                    priv,
                    200
                );
        return TypedResults.Ok(
            new ActivityMappingResponse
            (
                operationName,
                activities?.AuditCategory ?? "Unknown",
                activities?.Service ?? "Unknown",
                activities?.MappedResourceActions?.Select(a => a.Action) ?? [],
                allActions
        ));
    }
    private record class ActivityMappingResponse(
        string OperationName,
        string AuditCategory,
        string Service,
        IEnumerable<string> MappedActions,
        IEnumerable<ResourceActionDto> AllActions
    );
    private record ActivityMappingRequest(string ActivityName);
}
