using Microsoft.Graph;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IGraphServiceFactory
{
    Task<GraphServiceClient> CreateForUserAsync();
}
