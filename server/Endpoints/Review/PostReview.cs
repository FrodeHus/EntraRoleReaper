using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Review;

public class PostReview : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/", Handle)
            .WithSummary("Performs a role review")
            .RequireAuthorization();
    }

    private static async Task<Ok<ReviewResponse>> Handle(ReviewRequest request, [FromServices] IReviewService reviewService)
    {
        var report = await reviewService.ReviewAsync(request);
        return TypedResults.Ok(report);
    }
}