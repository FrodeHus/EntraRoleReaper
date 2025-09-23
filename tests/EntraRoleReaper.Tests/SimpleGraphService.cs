using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Tests;

internal class SimpleGraphService(Dictionary<string, bool> targetOwners) : IGraphService
{
    public Task<List<AuditActivity>> CollectAuditActivitiesAsync(string uid, DateTimeOffset from, DateTimeOffset to)
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

    public Task<List<ResourceActionDto>> GetResourceActionMetadataAsync()
    {
        return Task.FromResult<List<ResourceActionDto>>([]);
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

    public Task<string?> ActivatePIMRole(string roleId, int durationMinutes = 60)
    {
        throw new NotImplementedException();
    }

    public Task<string?> CreateCustomRole(string roleName, string description, List<string> permissions)
    {
        throw new NotImplementedException();
    }
}
