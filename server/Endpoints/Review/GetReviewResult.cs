using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Http.HttpResults;
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

    private static Results<Ok<ReviewJobResult>,BadRequest<string>, NotFound, ForbidHttpResult, Accepted> Handle([FromRoute] Guid id, [FromServices] IReviewCoordinator coordinator, HttpContext httpContext)
    {
        var tenantId = httpContext.Items["TenantId"] as Guid?;
        if (tenantId is null) return TypedResults.BadRequest("TenantId is required");
        var job = coordinator.Get(id);
        if (job is null) return TypedResults.NotFound();
        if (job.TenantId != tenantId) return TypedResults.Forbid();
        return job is { Status: ReviewJobStatus.Completed, Result: not null }
            ? TypedResults.Ok(job.Result)
            : TypedResults.Accepted("Review job is not completed yet");
    }
}
