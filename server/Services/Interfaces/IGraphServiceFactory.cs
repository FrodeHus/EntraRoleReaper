using Microsoft.Graph;

namespace RoleReaper.Services;

public interface IGraphServiceFactory
{
    Task<GraphServiceClient> CreateForUserAsync();
}
