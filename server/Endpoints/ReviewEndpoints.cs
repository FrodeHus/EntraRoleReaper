using RoleReaper.Services;
using RoleReaper.Data;

namespace RoleReaper.Endpoints;

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
