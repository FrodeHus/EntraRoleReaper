

using EntraRoleReaper.Api.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Activities;

public class GetExport : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/export", Handle)
            .WithSummary("Exports the activity with mappings")
            .RequireAuthorization();
    }

    private static async Task<Ok<IEnumerable<ActivityExport>>> Handle([FromServices] IActivityService svc)
    {
        var data = await svc.ExportActivitiesAsync();
        return TypedResults.Ok(data);
    }
}
