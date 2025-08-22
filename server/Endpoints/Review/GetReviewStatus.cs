using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class GetReviewStatus : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/{id:guid}/status", Handle)
            .WithSummary("Gets the status of a queued review job")
            .RequireAuthorization();
    }

    private static IResult Handle([FromRoute] Guid id, [FromServices] IReviewCoordinator coordinator, HttpContext httpContext)
    {
        var tenantId = httpContext.Items["TenantId"] as Guid?;
        if (tenantId is null) return Results.BadRequest(new { error = "TenantId is required" });
        var job = coordinator.Get(id);
        if (job is null) return Results.NotFound();
        if (job.TenantId != tenantId) return Results.Forbid();
        return Results.Ok(new
        {
            id = job.Id,
            status = job.Status.ToString(),
            enqueuedAt = job.EnqueuedAt,
            startedAt = job.StartedAt,
            completedAt = job.CompletedAt,
            error = job.Error
        });
    }
}
