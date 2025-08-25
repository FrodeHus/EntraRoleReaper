using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class RoleRepository(ReaperDbContext dbContext, IResourceActionRepository resourceActionRepository, ILogger<RoleRepository> logger) : IRoleRepository
{
    public Task<int> GetRoleCountAsync(bool customRolesOnly = false)
    {
        if (customRolesOnly)
        {
            return dbContext.RoleDefinitions.CountAsync(r => !r.IsBuiltIn);
        }

        {
            return dbContext.RoleDefinitions.CountAsync();
        }
    }

    public Task ClearAsync()
    {
        dbContext.RoleDefinitions.RemoveRange(dbContext.RoleDefinitions);
        return dbContext.SaveChangesAsync();
    }


    public Task<List<RoleDefinition>> GetTenantCustomRolesAsync(Guid tenantId)
    {
        return dbContext.RoleDefinitions
            .Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .Where(r => r.TenantId == tenantId && !r.IsBuiltIn).ToListAsync();
    }

    public async Task AddRangeAsync(IEnumerable<RoleDefinition> roles)
    {
        var roleDefinitions = roles.ToList();
        if (roleDefinitions.Count == 0)
        {
            return;
        }

        try
        {
            foreach (var role in roleDefinitions)
            {
                var existing = await dbContext.FindAsync<RoleDefinition>(role.Id);
                if (existing is not null)
                {
                    continue; // Skip existing roles
                }
                dbContext.RoleDefinitions.Add(role);
            }

            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            // Handle specific database update exceptions if needed
            logger.LogError(ex, "Failed to trying to add roles.");
            throw new Exception("An error occurred while adding roles.", ex);
        }
    }
    public async Task AddRoleAsync(RoleDefinition role)
    {
        if (role == null)
        {
            throw new ArgumentNullException(nameof(role));
        }
        try
        {
            foreach (var permissionSet in role.PermissionSets)
            {
                if (permissionSet.ResourceActions == null) continue;
                var existingActions = await resourceActionRepository
                    .GetResourceActionsByNamesAsync(permissionSet.ResourceActions.Select(ra => ra.Action));

                // Update the resource actions in the permission set with existing ones
                permissionSet.ResourceActions.RemoveAll(a => existingActions.Any(existing => existing.Action.Equals(a.Action, StringComparison.InvariantCultureIgnoreCase)));
                var newResourceActions = new List<ResourceAction>();
                foreach (var action in permissionSet.ResourceActions)
                {
                    // Ensure each resource action is added to the repository
                    newResourceActions.Add(await resourceActionRepository.AddAsync(action));
                }
                permissionSet.ResourceActions.AddRange(existingActions);
                permissionSet.ResourceActions.AddRange(newResourceActions);
            }
            dbContext.RoleDefinitions.Add(role);
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            // Handle specific database update exceptions if needed
            throw new Exception("An error occurred while adding the role.", ex);
        }
    }

    public Task<List<RoleDefinition>> GetAllRolesAsync(Guid? tenantId)
    {
        return dbContext
            .RoleDefinitions.Where(r => r.TenantId == tenantId || r.TenantId == null)
            .Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .ToListAsync();
    }

    public Task<RoleDefinition?> GetRoleByIdAsync(Guid roleId)
    {

        return dbContext
            .RoleDefinitions.Include(r => r.PermissionSets)
            .ThenInclude(ps => ps.ResourceActions)
            .FirstOrDefaultAsync(r => r.Id == roleId);
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
