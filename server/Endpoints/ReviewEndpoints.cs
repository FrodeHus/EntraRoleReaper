using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Endpoints;

public static class ReviewEndpoints
{
    public static IEndpointRouteBuilder MapReview(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/review", async (ReviewRequest request, IReviewService svc) =>
        {
            var result = await svc.ReviewAsync(request);
            return Results.Ok(result);
        }).RequireAuthorization();
        return app;
    }
}
