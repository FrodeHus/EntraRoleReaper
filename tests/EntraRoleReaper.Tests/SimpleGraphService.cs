using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Tests;
public partial class ActivityPermissionAnalyzerTests
{
    private class SimpleGraphService(Dictionary<string, bool> targetOwners) : IGraphService
    {
        public Task<List<AuditActivity>> CollectAuditActivitiesAsync(ReviewRequest request, string uid)
        {
            return Task.FromResult<List<AuditActivity>>([]);
        }

        public Task<HashSet<string>> ExpandUsersOrGroupsAsync(IEnumerable<string> usersOrGroups)
        {
            return Task.FromResult<HashSet<string>>([]);
        }

        public Task<List<Microsoft.Graph.Models.UnifiedRoleDefinition>?> GetAllRoleDefinitions()
        {
            return Task.FromResult<List<Microsoft.Graph.Models.UnifiedRoleDefinition>?>([]);
        }

        public Task<Dictionary<string, bool>> GetResourceActionMetadataAsync()
        {
            return Task.FromResult<Dictionary<string, bool>>([]);
        }

        public Task<(string DisplayName, List<string> ActiveRoleIds, List<string> EligibleRoleIds, HashSet<string> PimActiveRoleIds)> GetUserAndRolesAsync(string uid)
        {
            throw new NotImplementedException();
        }

        public Task<bool> IsOwnerAsync(string userId, AuditTargetResource target)
        {
            return Task.FromResult(targetOwners[target.Id]);
        }
    }
}
