using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class PostCancelReview : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/{id:guid}/cancel", Handle)
            .WithSummary("Cancels a queued review job")
            .RequireAuthorization();
    }

    private static IResult Handle([FromRoute] Guid id, ClaimsPrincipal user, [FromServices] IReviewCoordinator coordinator, HttpContext httpContext)
    {
        var tenantId = httpContext.Items["TenantId"] as Guid?;
        if (tenantId is null) return Results.BadRequest(new { error = "TenantId is required" });
        var job = coordinator.Get(id);
        if (job is null) return Results.NotFound();
        if (job.TenantId != tenantId) return Results.Forbid();
        string requestedBy =
            user.FindFirst("oid")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("preferred_username")?.Value
            ?? user.Identity?.Name
            ?? "anonymous";

        var (success, error) = coordinator.Cancel(id, requestedBy);
        if (!success)
        {
            if (error == "Not found") return Results.NotFound();
            if (error == "Forbidden") return Results.Forbid();
            return Results.BadRequest(new { error });
        }
        return Results.Ok(new { id, status = "Cancelled" });
    }
}
