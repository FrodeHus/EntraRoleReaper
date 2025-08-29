using EntraRoleReaper.Api.Endpoints;
using EntraRoleReaper.Api.Modules.Entra;

namespace EntraRoleReaper.Api;

public static class EndpointMapper
{
    public static void MapEndpoints(this WebApplication app)
    {
        app.UseEntraModule();
    }



    public static IEndpointRouteBuilder MapEndpoint<TEndpoint>(this IEndpointRouteBuilder app)
        where TEndpoint : IEndpoint
    {
        TEndpoint.Map(app);
        return app;
    }
}
