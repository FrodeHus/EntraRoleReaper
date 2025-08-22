using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class GetReviewJobs : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/jobs", Handle)
            .WithSummary("Lists review jobs for the current user")
            .RequireAuthorization();
    }

    private static IResult Handle([FromServices] IReviewCoordinator coordinator, ClaimsPrincipal user, HttpContext httpContext, [FromQuery] bool all = false)
    {
        var tenantId = httpContext.Items["TenantId"] as Guid?;
        if (tenantId is null) return Results.BadRequest(new { error = "TenantId is required" });
        string requestedBy =
            user.FindFirst("oid")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("preferred_username")?.Value
            ?? user.Identity?.Name
            ?? "anonymous";

        var jobs = coordinator.List(tenantId);
        if (!all)
        {
            jobs = jobs.Where(j => string.Equals(j.RequestedBy, requestedBy, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        var shaped = jobs.Select(j => new
        {
            id = j.Id,
            status = j.Status.ToString(),
            enqueuedAt = j.EnqueuedAt,
            startedAt = j.StartedAt,
            completedAt = j.CompletedAt,
            error = j.Error,
            targetCount = j.Request.UsersOrGroups?.Count ?? 0,
            userCount = j.Result?.Results?.Count ?? null,
            requestedBy = j.RequestedBy,
            from = j.Request.From,
            to = j.Request.To
        });
        return Results.Ok(shaped);
    }
}
