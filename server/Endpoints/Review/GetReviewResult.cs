using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class GetReviewResult : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/{id:guid}/result", Handle)
            .WithSummary("Gets the result of a completed review job")
            .RequireAuthorization();
    }

    private static IResult Handle([FromRoute] Guid id, [FromServices] IReviewCoordinator coordinator, HttpContext httpContext)
    {
        var tenantId = httpContext.Items["TenantId"] as Guid?;
        if (tenantId is null) return Results.BadRequest(new { error = "TenantId is required" });
        var job = coordinator.Get(id);
        if (job is null) return Results.NotFound();
        if (job.TenantId != tenantId) return Results.Forbid();
        return job.Status == ReviewJobStatus.Completed && job.Result is not null
            ? Results.Ok(job.Result)
            : Results.StatusCode(StatusCodes.Status202Accepted);
    }
}
