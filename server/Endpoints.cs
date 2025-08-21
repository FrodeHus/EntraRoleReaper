using EntraRoleReaper.Api.Endpoints;
using EntraRoleReaper.Api.Endpoints.Activities;
using EntraRoleReaper.Api.Endpoints.Cache;
using EntraRoleReaper.Api.Endpoints.Onboarding;
using EntraRoleReaper.Api.Endpoints.Review;
using EntraRoleReaper.Api.Endpoints.Roles;
using EntraRoleReaper.Api.Endpoints.Search;

namespace EntraRoleReaper.Api;

public static class EndpointMapper
{
    public static void MapEndpoints(this WebApplication app)
    {
        app.MapActivityEndpoints();
        app.MapRoleEndpoints();
        app.MapReviewEndpoints();
        app.MapSearchEndpoints();
        app.MapCacheEndpoints();
        app.MapResourceActionEndpoints();
        app.MapOnboardingEndpoints();
    }

    private static void MapRoleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/roles")
            .WithTags("Roles");

        group.MapEndpoint<GetRole>()
            .MapEndpoint<GetRoleSummary>();
    }

    private static void MapReviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/review")
            .WithTags("Review");
        group.MapEndpoint<PostReview>();
    }

    private static void MapSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<GetSearch>();
    }

    private static void MapCacheEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cache")
            .WithTags("Cache");
        group.MapEndpoint<GetStatus>();
        group.MapEndpoint<PostRefresh>();
    }

    private static void MapResourceActionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/resourceaction")
            .WithTags("Resource Actions");
        group.MapEndpoint<EntraRoleReaper.Api.Endpoints.ResourceActions.GetSearch>();
    }

    private static void MapOnboardingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/onboarding")
            .WithTags("Onboarding");
        group.MapEndpoint<PostVerify>();
    }

    private static void MapActivityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/activity")
            .WithTags("Activities");
        group
            .MapEndpoint<GetAllActivities>()
            .MapEndpoint<GetExport>()
            .MapEndpoint<PostImport>()
            .MapEndpoint<PutActivityMapping>()
            .MapEndpoint<GetActivityMapping>()
            .MapEndpoint<PutActivityPropertyMapping>()
            .MapEndpoint<DeleteActivityPropertyMapping>()
            .MapEndpoint<PostExclude>()
            .MapEndpoint<DeleteExclude>()
            .MapEndpoint<GetExcludedActivities>();
    }
    private static IEndpointRouteBuilder MapEndpoint<TEndpoint>(this IEndpointRouteBuilder app)
        where TEndpoint : IEndpoint
    {
        TEndpoint.Map(app);
        return app;
    }
}