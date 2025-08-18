

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class PostImport : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/import", Handle)
            .WithSummary("Imports activities from a file")
            .RequireAuthorization();
    }

    private static async Task<Ok<ImportResult>> Handle(IEnumerable<ActivityExport> importedData, [FromServices] IActivityService svc)
    {
        var result = await svc.ImportAsync(importedData);
        return TypedResults.Ok(
            result
        );
    }
}
