using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Tests;
internal class SimpleGraphService(Dictionary<string, bool> targetOwners) : IGraphService
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

    public Task<bool> IsOwnerAsync(string userId, ReviewTargetResource target)
    {
        return Task.FromResult(targetOwners[target.Id]);
    }

    public Task<Tenant?> FetchTenantMetadataAsync(Guid tenantId, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}
