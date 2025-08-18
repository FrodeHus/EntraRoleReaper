using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;

public interface IRoleRepository
{
    Task<List<RoleDefinition>> GetAllRolesAsync(Guid? tenantId);

    Task<RoleDefinition?> GetRoleByIdAsync(Guid roleId);

    Task<RoleDefinition?> GetRoleByNameAsync(string roleName);

    Task UpdateRoleAsync(RoleDefinition role);

    Task AddRoleAsync(RoleDefinition role);
    Task AddRangeAsync(IEnumerable<RoleDefinition> roles);
    Task<int> GetRoleCountAsync();
    Task ClearAsync();
    Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string searchTerm, bool privilegedOnly = false, int limit = 100);
}
