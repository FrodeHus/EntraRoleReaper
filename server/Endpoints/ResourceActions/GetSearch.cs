using EntraRoleReaper.Api.Modules.Entra.Roles.Repositories;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.ResourceActions;

public class GetSearch : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/search", Handle)
            .WithSummary("Searches for resource actions")
            .RequireAuthorization();
    }

    private static async Task<Ok<ResourceActionSearchResponse[]>> Handle(
        string? q,
        string? @namespace,
        string? namespaces,
        string? resourceGroups,
        bool? priv,
        int? limit,
        [FromServices] IResourceActionRepository resourceActionRepository
    )
    {
        var take = limit.GetValueOrDefault(30);
        if (take < 1)
            take = 1;
        if (take > 200)
            take = 200;

        // Accept either single namespace via "namespace" or comma-separated list via "namespaces"
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

        var items = await resourceActionRepository.SearchResourceActionsAsync(
            q,
            nsFilter,
            rgFilter,
            priv,
            take
        );
        return TypedResults.Ok(items.Select(x => new ResourceActionSearchResponse(x.Id, x.Action, x.IsPrivileged)).ToArray());
    }

    private record ResourceActionSearchResponse(Guid Id, string Action, bool IsPrivileged);
}