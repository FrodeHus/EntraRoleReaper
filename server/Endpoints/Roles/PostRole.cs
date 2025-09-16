using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Roles;

public class PostRole : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/", Handle)
            .WithSummary("Creates a new role definition")
            .RequireAuthorization();
    }

    private static async Task<Created> Handle(RoleRequest req, [FromServices] IGraphService graphService)
    {
        var result = await graphService.CreateCustomRole(
            req.DisplayName,
            req.Description,
            req.ResourceActions
        );
        return TypedResults.Created(new Uri($"/roles/{result}", UriKind.Relative));
    }

    [UsedImplicitly]
    private record RoleRequest(
        string DisplayName,
        string Description,
        List<string> ResourceActions
    );
}