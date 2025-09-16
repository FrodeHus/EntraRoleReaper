using EntraRoleReaper.Api.Endpoints;
using JetBrains.Annotations;

namespace EntraRoleReaper.Api.Modules.Entra.Endpoints;

public class CreateReview : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPost("/review", Handle)
            .WithSummary("Creates a new review")
            .RequireAuthorization();
    }

    private static Task Handle(ReviewRequest request)
    {
        throw new NotImplementedException();
    }

    [UsedImplicitly]
    private record ReviewRequest(
        List<string>? Users,
        List<string>? Groups,
        int DurationDays = 30
    );
}