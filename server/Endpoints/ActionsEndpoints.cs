using EntraRoleReaper.Api.Data.Repositories;

namespace EntraRoleReaper.Api.Endpoints;

public static class ActionsEndpoints
{
    public static IEndpointRouteBuilder MapActions(this IEndpointRouteBuilder app)
    {


        // Incremental search for resource actions by substring, limited result set
        app.MapGet(
                "/api/actions/search",
                async (string q, int? limit, IResourceActionRepository resourceActionRepository) =>
                {
                    if (string.IsNullOrWhiteSpace(q))
                        return Results.Ok(Array.Empty<object>());
                    var term = q.Trim();
                    var take = limit.GetValueOrDefault(30);
                    if (take < 1)
                        take = 1;
                    if (take > 200)
                        take = 200;

                    var items = await resourceActionRepository.SearchResourceActionsAsync(term, take);
                    return Results.Ok(items.Select(x => new { x.Id, x.Action, x.IsPrivileged }));
                }
            )
            .RequireAuthorization();
        return app;
    }
}
