using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class ResourceActionRepository(ReaperDbContext dbContext) : IResourceActionRepository
{
    public async Task<ResourceAction> AddAsync(ResourceAction resourceAction)
    {
        if (resourceAction == null) throw new ArgumentNullException(nameof(resourceAction));

        try
        {
            var existingAction = await dbContext.ResourceActions
                .FirstOrDefaultAsync(x => x.Action == resourceAction.Action);
            if (existingAction != null)
            {
                return existingAction;
            }
            dbContext.ResourceActions.Add(resourceAction);
            await dbContext.SaveChangesAsync();
            return resourceAction;
        }
        catch (DbUpdateException ex)
        {
            // Handle specific database update exceptions if needed
            throw new Exception("An error occurred while adding the resource action.", ex);
        }
    }

    public async Task<ResourceAction?> GetResourceActionByNameAsync(string name)
    {
        return await dbContext.ResourceActions.FirstOrDefaultAsync(x => x.Action == name);
    }

    public async Task<ResourceAction?> GetResourceActionByIdAsync(Guid id)
    {
        return await dbContext.ResourceActions.FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IEnumerable<ResourceAction>> SearchResourceActionsAsync(string searchTerm, int limit = 100)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return await dbContext.ResourceActions.Take(limit).ToListAsync();
        }
        searchTerm = searchTerm.Contains('*') ? searchTerm.Replace('*', '%').ToLowerInvariant() : $"%{searchTerm}%";
        return await dbContext.ResourceActions
            .Where(x => EF.Functions.Like(x.Action, searchTerm))
            .OrderBy(x => x.Action)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<ICollection<ResourceAction>> GetResourceActionsByIdsAsync(Guid[] resourceActionIds)
    {
        if (resourceActionIds.Length == 0)
        {
            return [];
        }

        return await dbContext.ResourceActions
            .Where(x => resourceActionIds.Contains(x.Id))
            .ToListAsync();
    }

    public async Task<ICollection<ResourceAction>> GetResourceActionsByNamesAsync(
        IEnumerable<string> resourceActionNames)
    {
        var actionNames = resourceActionNames.ToList();
        if (actionNames.Count == 0)
        {
            return [];
        }

        return await dbContext.ResourceActions
            .Where(x => actionNames.Contains(x.Action))
            .ToListAsync();
    }

    public async Task<ICollection<ResourceAction>> GetAllAsync()
    {
        return await dbContext.ResourceActions
            .OrderBy(x => x.Action)
            .ToListAsync();
    }
}
