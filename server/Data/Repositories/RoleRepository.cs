using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class RoleRepository(ReaperDbContext dbContext) : IRoleRepository
{
    public Task<int> GetRoleCountAsync()
    {
        return dbContext.RoleDefinitions.CountAsync();
    }

    public Task AddRoleAsync(RoleDefinition role)
    {
        if (role == null)
        {
            throw new ArgumentNullException(nameof(role));
        }

        dbContext.RoleDefinitions.Add(role);
        return dbContext.SaveChangesAsync();
    }

    public Task<List<RoleDefinition>> GetAllRolesAsync()
    {
        return dbContext
            .RoleDefinitions.Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .ToListAsync();
    }

    public Task<RoleDefinition?> GetRoleByIdAsync(string roleId)
    {
        if (string.IsNullOrWhiteSpace(roleId))
        {
            throw new ArgumentException("Role ID cannot be null or empty.", nameof(roleId));
        }

        return dbContext
            .RoleDefinitions.Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .FirstOrDefaultAsync(r => r.Id.ToString() == roleId);
    }

    public Task<RoleDefinition?> GetRoleByNameAsync(string roleName)
    {
        if (string.IsNullOrWhiteSpace(roleName))
        {
            throw new ArgumentException("Role name cannot be null or empty.", nameof(roleName));
        }

        return dbContext
            .RoleDefinitions.Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .FirstOrDefaultAsync(r => r.DisplayName == roleName);
    }

    public Task UpdateRoleAsync(RoleDefinition role)
    {
        if (role == null)
        {
            throw new ArgumentNullException(nameof(role));
        }

        dbContext.RoleDefinitions.Update(role);
        return dbContext.SaveChangesAsync();
    }
}
