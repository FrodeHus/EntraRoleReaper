using EntraRoleReaper.Api.Endpoints;
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
        app.MapRoleEndpoints();
        app.MapReviewEndpoints();
        app.MapSearchEndpoints();
        app.MapCacheEndpoints();
        app.MapResourceActionEndpoints();
        app.MapOnboardingEndpoints();
    }
    
    private static void MapRoleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<GetRole>();
        // Add other role-related endpoints here
    }
    
    private static void MapReviewEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<PostReview>();
        // Add other review-related endpoints here
    }
    
    private static void MapSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<GetSearch>();
    }
    
    private static void MapCacheEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<GetStatus>();
        app.MapEndpoint<PostRefresh>();
    }
    
    private static void MapResourceActionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<EntraRoleReaper.Api.Endpoints.ResourceActions.GetSearch>();
    }
    
    private static void MapOnboardingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<PostVerify>();
    }
    private static IEndpointRouteBuilder MapEndpoint<TEndpoint>(this IEndpointRouteBuilder app)
        where TEndpoint : IEndpoint
    {
        TEndpoint.Map(app);
        return app;
    }
}