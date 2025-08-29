using EntraRoleReaper.Api.Endpoints.Activities;
using EntraRoleReaper.Api.Endpoints.Cache;
using EntraRoleReaper.Api.Endpoints.Onboarding;
using EntraRoleReaper.Api.Endpoints.Review;
using EntraRoleReaper.Api.Endpoints.Roles;
using EntraRoleReaper.Api.Endpoints.Search;
using EntraRoleReaper.Api.Endpoints.TargetResources;
using EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;
using EntraRoleReaper.Api.Review;

namespace EntraRoleReaper.Api.Modules.Entra;

public static class EntraModuleExtensions
{
    public static IServiceCollection AddEntraModule(this IServiceCollection services, WebApplication app, IConfiguration configuration)
    {

        services.AddTransient<RoleEvaluationService>();
        services.RegisterEntraRoleEvaluators();
        return services;
    }

    private static void RegisterEntraRoleEvaluators(this IServiceCollection services)
    {
        services.AddTransient<IEvaluateRole, ResourceOwnerEvaluator>();
    }

    public static WebApplication UseEntraModule(this WebApplication app)
    {
        app.MapActivityEndpoints();
        app.MapRoleEndpoints();
        app.MapReviewEndpoints();
        app.MapSearchEndpoints();
        app.MapCacheEndpoints();
        app.MapResourceActionEndpoints();
        app.MapOnboardingEndpoints();
        return app;
    }

    private static void MapRoleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/roles").WithTags("Roles");

        group.MapEndpoint<GetRole>().MapEndpoint<GetRoleSummary>();
    }

    private static void MapReviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/review").WithTags("Review");
        group
            .MapEndpoint<PostReview>()
            .MapEndpoint<GetReviewStatus>()
            .MapEndpoint<GetReviewResult>()
            .MapEndpoint<GetReviewJobs>()
            .MapEndpoint<PostCancelReview>();
    }

    private static void MapSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapEndpoint<GetSearch>();
    }

    private static void MapCacheEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cache").WithTags("Cache");
        group.MapEndpoint<GetStatus>();
        group.MapEndpoint<PostRefresh>();
    }

    private static void MapResourceActionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/resourceaction").WithTags("Resource Actions");
        group.MapEndpoint<EntraRoleReaper.Api.Endpoints.ResourceActions.GetSearch>();
    }

    private static void MapOnboardingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/onboarding").WithTags("Onboarding");
        group.MapEndpoint<PostVerify>().MapEndpoint<GetTenant>().MapEndpoint<GetVerifyAccess>();
    }

    private static void MapActivityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/activity").WithTags("Activities");
        group
            .MapEndpoint<GetAllActivities>()
            .MapEndpoint<GetExport>()
            .MapEndpoint<PostImport>()
            .MapEndpoint<PutActivityMapping>()
            .MapEndpoint<PutActivityTargetResourcePropertyMapping>()
            .MapEndpoint<GetActivityMapping>()
            .MapEndpoint<PostExclude>()
            .MapEndpoint<DeleteExclude>()
            .MapEndpoint<GetTargetResource>()
            .MapEndpoint<PutTargetResource>()
            .MapEndpoint<PostTargetResource>()
            .MapEndpoint<GetTargetResourceByActivity>()
            .MapEndpoint<GetExcludedActivities>();
    }
}
