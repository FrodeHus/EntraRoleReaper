namespace EntraRoleReaper.Api.Endpoints;

public interface IEndpoint
{
    static abstract void Map(IEndpointRouteBuilder builder);
}