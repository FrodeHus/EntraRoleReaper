using EntraRoleReaper.Api.Services.Models;
using Microsoft.Graph.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IRoleCache
{
    Task InitializeAsync(bool forceRefresh = false);
    Task RefreshAsync();
    Task<DateTimeOffset?> GetLastUpdatedAsync();
    IReadOnlyDictionary<string, UnifiedRoleDefinition> GetAll();
    IReadOnlyDictionary<string, bool> GetActionPrivilegeMap();
    IReadOnlyDictionary<string, RolePrivilegeStats> GetRolePrivilegeStats();
}
