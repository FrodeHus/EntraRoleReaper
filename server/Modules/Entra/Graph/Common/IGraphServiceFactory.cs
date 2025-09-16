using Microsoft.Graph;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Common;

public interface IGraphServiceFactory
{
    Task<GraphServiceClient> CreateForUserAsync();
}
