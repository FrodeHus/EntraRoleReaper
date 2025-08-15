using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class RoleRepository(ReaperDbContext dbContext, IResourceActionRepository resourceActionRepository, ILogger<RoleRepository> logger) : IRoleRepository
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

    public async Task AddRangeAsync(IEnumerable<RoleDefinition> roles)
    {
        if (roles == null || !roles.Any())
        {
            return;
        }

        try
        {
            foreach (var role in roles)
            {
                dbContext.RoleDefinitions.Add(role);
            }

            await dbContext.SaveChangesAsync();
        }catch (DbUpdateException ex)
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
                if (permissionSet.ResourceActions != null)
                {
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
            }
            dbContext.RoleDefinitions.Add(role);
            await dbContext.SaveChangesAsync();
            return;
        }
        catch (DbUpdateException ex)
        {
            // Handle specific database update exceptions if needed
            throw new Exception("An error occurred while adding the role.", ex);
        }
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
