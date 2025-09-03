using EntraRoleReaper.Api.Endpoints;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http.HttpResults;

namespace EntraRoleReaper.Api.Modules.Entra.Endpoints;

public class PostActivatePIMRole : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/activate-pim-role", Handle)
            .WithSummary("Activates a PIM role for the current user")
            .RequireAuthorization();
    }

    private static async Task<Ok<string>> Handle(ActivatePIMRoleRequest request, IGraphService graphService)
    {
        var status = await graphService.ActivatePIMRole(
            request.RoleId.ToString(),
            request.DurationHours * 60
        );
        return TypedResults.Ok(status);
    }
    
    [UsedImplicitly]
    private record ActivatePIMRoleRequest(
        string RoleId,
        int DurationHours = 1,
        string? Reason = null
    );
}