using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class RoleRepository(ReaperDbContext dbContext) : IRoleRepository
{
    public Task<int> GetRoleCountAsync()
    {
        return dbContext.RoleDefinitions.CountAsync();
    }

    public Task ClearAsync()
    {
        dbContext.RoleDefinitions.RemoveRange(dbContext.RoleDefinitions);
        return dbContext.SaveChangesAsync();
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

        // Parse to Guid and compare strongly to avoid case-sensitive string mismatches
        if (!Guid.TryParse(roleId, out var roleGuid))
        {
            // Fallback to string compare if parsing fails (shouldn't happen for valid requests)
            return dbContext
                .RoleDefinitions.Include(r => r.PermissionSets)
                .ThenInclude(ps => ps.ResourceActions)
                .FirstOrDefaultAsync(r => r.Id.ToString() == roleId);
        }

        return dbContext
            .RoleDefinitions.Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .FirstOrDefaultAsync(r => r.Id == roleGuid);
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
    
    public async Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string searchTerm, bool privilegedOnly = false, int limit = 100)
    {
        IQueryable<RoleDefinition> query = dbContext.RoleDefinitions;

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var pattern = searchTerm.Contains('*') ? searchTerm.Replace('*', '%').ToLowerInvariant() : $"%{searchTerm}%";
            query = query.Where(x => EF.Functions.Like(x.DisplayName, pattern));
        }

        if (privilegedOnly)
        {
            query = query.Where(x => x.PermissionSets.Any(p =>
                p.ResourceActions != null && p.ResourceActions.Any(ra => ra.IsPrivileged)));
        }

        return await query
            .OrderBy(x => x.DisplayName)
            .Take(limit)
            .ToListAsync();
    }
}
