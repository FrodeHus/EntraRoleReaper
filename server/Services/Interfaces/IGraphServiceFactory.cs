using Microsoft.Graph;

namespace EntraRoleAssignmentAuditor.Services;

public interface IGraphServiceFactory
{
    Task<GraphServiceClient> CreateForUserAsync();
}
