using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.ResourceActions;

public class GetSearch : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/api/actions/search", Handle)
            .WithSummary("Searches for resource actions")
            .RequireAuthorization();
    }

    private static async Task<Ok<ResourceActionSearchResponse[]>> Handle(string q, int? limit, [FromServices] IResourceActionRepository resourceActionRepository)
    {
        if (string.IsNullOrWhiteSpace(q))
            return TypedResults.Ok(Array.Empty<ResourceActionSearchResponse>());
        var term = q.Trim();
        var take = limit.GetValueOrDefault(30);
        if (take < 1)
            take = 1;
        if (take > 200)
            take = 200;

        var items = await resourceActionRepository.SearchResourceActionsAsync(term, take);
        return TypedResults.Ok(items.Select(x => new ResourceActionSearchResponse(x.Id, x.Action, x.IsPrivileged)).ToArray());
    }
    
    private record ResourceActionSearchResponse(Guid Id, string Action, bool IsPrivileged);
}