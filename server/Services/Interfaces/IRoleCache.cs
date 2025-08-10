using Microsoft.Graph.Models;

namespace RoleReaper.Services;

public interface IRoleCache
{
    Task InitializeAsync();
    IReadOnlyDictionary<string, UnifiedRoleDefinition> GetAll();
    IReadOnlyDictionary<string, bool> GetActionPrivilegeMap();
    IReadOnlyDictionary<string, RolePrivilegeStats> GetRolePrivilegeStats();
}
