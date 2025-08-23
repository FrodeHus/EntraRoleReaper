using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class PostReview : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/", Handle)
            .WithSummary("Queues a role review job and returns the job id")
            .RequireAuthorization();
    }

    private static IResult Handle(
        ReviewRequest request,
        ClaimsPrincipal user,
        [FromServices] IReviewCoordinator coordinator,
        IHttpContextAccessor httpContextAccessor
    )
    {
        var tenantId = httpContextAccessor.HttpContext?.Items["TenantId"] as Guid?;
        if (tenantId is null)
        {
            return TypedResults.BadRequest(new { error = "TenantId is required" });
        }
        // Identify requester (prefer stable object id, fall back to name/UPN)
        string requestedBy =
            user.FindFirst(ClaimTypes.Upn)?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.Identity?.Name
            ?? "anonymous";

        // If there is already an identical queued/running job for this user and same targets, reuse it
        var targets = new HashSet<string>(
            request.UsersOrGroups ?? [],
            StringComparer.OrdinalIgnoreCase
        );
        var dup = coordinator
            .List(tenantId)
            .FirstOrDefault(j =>
                j.RequestedBy.Equals(requestedBy, StringComparison.OrdinalIgnoreCase)
                && (j.Status is ReviewJobStatus.Queued or ReviewJobStatus.Running)
                && new HashSet<string>(
                    j.Request.UsersOrGroups ?? [],
                    StringComparer.OrdinalIgnoreCase
                ).SetEquals(targets)
            );
        if (dup is not null)
        {
            return TypedResults.Ok(
                new
                {
                    id = dup.Id,
                    status = dup.Status.ToString(),
                    duplicate = true,
                }
            );
        }

        var auth = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        var token = (auth?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ?? false) ? auth[7..] : null;
        var id = coordinator.Enqueue(tenantId.Value, requestedBy, request, token);
        return TypedResults.Ok(
            new
            {
                id,
                status = nameof(ReviewJobStatus.Queued),
                duplicate = false,
            }
        );
    }
}