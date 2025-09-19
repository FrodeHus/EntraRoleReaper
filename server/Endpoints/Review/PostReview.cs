using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using JetBrains.Annotations;

namespace EntraRoleReaper.Api.Endpoints.Review;

[UsedImplicitly]
public class PostReview : IEndpoint
{
    [UsedImplicitly]
    private record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);

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

        var requestedBy =
            user.FindFirst(ClaimTypes.Upn)?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.Identity?.Name
            ?? "anonymous";

        var auth = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        var token = (auth?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ?? false) ? auth[7..] : null;
        var job = new ReviewJob(Guid.NewGuid(), requestedBy, request.UsersOrGroups, request.From, request.To, tenantId.Value, DateTimeOffset.UtcNow, null);
        
        var id = coordinator.Enqueue(job, token);
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