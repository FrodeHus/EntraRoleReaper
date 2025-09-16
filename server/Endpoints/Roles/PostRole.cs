using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Roles;

[UsedImplicitly]
public class PostRole : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/", Handle)
            .WithSummary("Creates a new role definition")
            .RequireAuthorization();
    }

    private static async Task<Results<CreatedAtRoute<CreateRoleResponse>, BadRequest>> Handle(CreateRoleRequest req,
        [FromServices] IGraphService graphService)
    {
        var result = await graphService.CreateCustomRole(
            req.DisplayName,
            req.Description,
            req.ResourceActions
        );
        if (string.IsNullOrEmpty(result))
            return TypedResults.BadRequest();
        var response = new CreateRoleResponse(result);
        return TypedResults.CreatedAtRoute(response, nameof(GetRole),
            new RouteValueDictionary(new { id = response.Id }));
    }

    [UsedImplicitly]
    private record CreateRoleRequest(
        string DisplayName,
        string Description,
        List<string> ResourceActions
    );

    private record CreateRoleResponse(
        string Id
    );
}