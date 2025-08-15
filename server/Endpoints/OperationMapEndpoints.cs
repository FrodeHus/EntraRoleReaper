using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Services;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints;

public static class OperationMapEndpoints
{
    public static IEndpointRouteBuilder MapOperationMap(this IEndpointRouteBuilder app)
    {
        // Single operation details
        app.MapGet(
                "/api/operations/map/{operationName}",
                async (string operationName, [FromServices] IActivityRepository activityRepository, [FromServices] IResourceActionRepository resourceActionRepository) =>
                {
                    if (string.IsNullOrWhiteSpace(operationName))
                        return Results.BadRequest();
                    var activities = await activityRepository.GetByNameAsync(operationName);
                    var allActions = await resourceActionRepository.GetAllAsync();
                    return Results.Ok(
                        new
                        {
                            operationName,
                            mapped = activities?.MappedResourceActions?.Select(a => a.Action) ?? [],
                            all = allActions
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Upsert base mapping
        app.MapPut(
                "/api/operations/map/{operationName}",
                async (
                    string operationName,
                    Guid[] actionIds,
                    [FromServices] IActivityRepository activityRepository,
                    [FromServices] IResourceActionRepository resourceActionRepository
                ) =>
                {
                    if (string.IsNullOrWhiteSpace(operationName))
                        return Results.BadRequest();
                    var dIds = actionIds?.Distinct().ToArray() ?? [];
                    var actions = await activityRepository.AddAsync(new Activity
                    {
                        Name = operationName.Trim(),
                        MappedResourceActions = await resourceActionRepository
                            .GetResourceActionsByIdsAsync(dIds),
                    });
                    return Results.Created();
                }
            )
            .RequireAuthorization();


        // Export (new format list)
        app.MapGet(
                "/api/operations/map/export",
                async ([FromServices] IActivityService svc) =>
                {
                    var data = await svc.ExportActivitiesAsync();
                    return Results.Ok(data);
                }
            )
            .RequireAuthorization();

        // Import (new format only)
        app.MapPost(
                "/api/operations/map/import",
                async (IEnumerable<ActivityExport> importedData, [FromServices] IActivityService svc) =>
                {
                    var result = await svc.ImportAsync(importedData);
                    return Results.Ok(
                        result
                    );
                }
            )
            .RequireAuthorization();


        // Upsert property map
        app.MapPut(
                "/api/operations/map/{activityName}/properties/{propertyName}",
                async (
                    string activityName,
                    string propertyName,
                    Guid[] actionIds,
                    [FromServices] IActivityService activityService
                ) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(activityName)
                        || string.IsNullOrWhiteSpace(propertyName)
                    )
                        return Results.BadRequest();
                    await activityService.AddPropertyMapToActivityAsync(activityName, propertyName, actionIds);
                    return Results.Ok();
                }
            )
            .RequireAuthorization();

        // Delete property map
        app.MapDelete(
                "/api/operations/map/{operationName}/properties/{propertyName}",
                async (
                    string operationName,
                    string propertyName,
                    [FromServices] IActivityService activityService
                ) =>
                {
                    await activityService.DeletePropertyMapAsync(
                        operationName,
                        propertyName
                    );
                    return Results.NoContent();
                }
            )
            .RequireAuthorization();

        // Exclusions create
        app.MapPost(
                "/api/operations/exclusions",
                async (OperationExclusionCreateRequest req, [FromServices] IActivityService activityService) =>
                {
                    if (string.IsNullOrWhiteSpace(req.OperationName))
                        return Results.BadRequest();
                    await activityService.SetExclusionAsync(req.OperationName.Trim(), true);
                    return Results.Ok();
                }
            )
            .RequireAuthorization();

        // Exclusions list
        app.MapGet(
                "/api/operations/exclusions",
                async ([FromServices] IActivityService activityService) =>
                {
                    var list = await activityService.GetExcludedActivitiesAsync();
                    return Results.Ok(list);
                }
            )
            .RequireAuthorization();

        // Exclusions delete
        app.MapDelete(
                "/api/operations/exclusions/{operationName}",
                async (string operationName, [FromServices] IActivityService activityService) =>
                {
                    await activityService.SetExclusionAsync(operationName, false);
                    return Results.NoContent();
                }
            )
            .RequireAuthorization();

        return app;
    }
}

[UsedImplicitly]
public record OperationExclusionCreateRequest(string? OperationName);