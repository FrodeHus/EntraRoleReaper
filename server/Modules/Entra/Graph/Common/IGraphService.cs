using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.Graph.Models;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Common;

public interface IGraphService
{
    Task<List<AuditActivity>> CollectAuditActivitiesAsync(string uid, DateTimeOffset from, DateTimeOffset to);
    Task<HashSet<string>> ExpandUsersOrGroupsAsync(IEnumerable<string> usersOrGroups);
    Task<List<UnifiedRoleDefinition>?> GetAllRoleDefinitions();
    Task<Dictionary<string, bool>> GetResourceActionMetadataAsync();
    Task<(string DisplayName, List<string> ActiveRoleIds, List<string> EligibleRoleIds, HashSet<string> PimActiveRoleIds)> GetUserAndRolesAsync(string uid);
    Task<bool> IsOwnerAsync(string userId, ReviewTargetResource target);
    Task<Tenant?> FetchTenantMetadataAsync(Guid tenantId, CancellationToken ct = default);
    Task<string?> ActivatePIMRole(string roleId, int durationMinutes = 60);
    Task<string?> CreateCustomRole(string roleName, string description, List<string> permissions);
}