using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Modules.Entra.Roles.Repositories;

public class ResourceActionRepository(ReaperDbContext dbContext) : Repository<ResourceAction>(dbContext), IResourceActionRepository
{
    public async Task<ResourceAction> AddAsync(ResourceAction resourceAction)
    {
        ArgumentNullException.ThrowIfNull(resourceAction);

        try
        {
            var existingAction = await dbSet
                .FirstOrDefaultAsync(x => x.Action == resourceAction.Action);
            if (existingAction != null)
            {
                existingAction.Description = resourceAction.Description;
                existingAction.IsPrivileged = resourceAction.IsPrivileged;
                existingAction.ActionVerb = resourceAction.ActionVerb;
                dbSet.Update(existingAction);
                return existingAction;
            }
            dbSet.Add(resourceAction);
            return resourceAction;
        }
        catch (DbUpdateException ex)
        {
            // Handle specific database update exceptions if needed
            throw new Exception("An error occurred while adding the resource action.", ex);
        }
    }

    public IEnumerable<ResourceAction> AddRange(IEnumerable<ResourceAction> resourceActions)
    {
        var addedResourceActions = resourceActions.ToList();
        if (addedResourceActions.Count == 0)
        {
            return [];
        }

        var addedActions = new List<ResourceAction>();
        foreach (var action in addedResourceActions)
        {
            var existingAction = dbSet
                .FirstOrDefault(x => x.Action == action.Action);
            if (existingAction != null)
            {
                addedActions.Add(existingAction);
            }
            else
            {
                addedActions.Add(action);
                Add(action);
            }
        }
        return addedActions;
    }

    public async Task<ResourceAction?> GetResourceActionByNameAsync(string name)
    {
        return await dbSet.FirstOrDefaultAsync(x => x.Action == name);
    }

    public async Task<ResourceAction?> GetResourceActionByIdAsync(Guid id)
    {
        return await GetById(id);
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

        return await dbSet
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

        return await dbSet
            .Where(x => actionNames.Contains(x.Action))
            .ToListAsync();
    }

    public async Task<ICollection<ResourceActionDto>> GetAllAsync()
    {
        return (await dbSet
            .OrderBy(x => x.Action)
            .ToListAsync()).ConvertAll(ResourceActionDto.FromResourceAction);
    }

    public async Task<ICollection<ResourceActionDto>> SearchResourceActionsAsync(
        string? q,
        IEnumerable<string>? namespaces,
        IEnumerable<string>? resourceGroups,
        bool? privOnly,
        int limit = 100
    )
    {
        var take = Math.Clamp(limit, 1, 200);
        IQueryable<ResourceAction> query = dbContext.ResourceActions.AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q!.Trim();
            var like = term.Contains('*') ? term.Replace('*', '%').ToLowerInvariant() : $"%{term}%";
            query = query.Where(x => EF.Functions.Like(x.Action, like));
        }

        if (privOnly == true)
        {
            query = query.Where(x => x.IsPrivileged);
        }

        // Filter by namespace/resource group using Action parsing since those fields are derived in DTO
        if (namespaces != null)
        {
            var nsList = namespaces
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToList();
            if (nsList.Count > 0)
            {
                query = query.Where(x => nsList.Contains(GetNamespace(x.Action)));
            }
        }
        if (resourceGroups != null)
        {
            var rgList = resourceGroups
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToList();
            if (rgList.Count > 0)
            {
                query = query.Where(x => rgList.Contains(GetResourceGroup(x.Action)));
            }
        }

        var results = await query.OrderBy(x => x.Action).Take(take).ToListAsync();
        return results.ConvertAll(ResourceActionDto.FromResourceAction);
    }

    private static string GetNamespace(string action)
    {
        var parts = (action ?? string.Empty).Split('/');
        if (parts.Length > 1)
            return string.Join('/', parts[..^1]);
        return string.Empty;
    }

    private static string GetResourceGroup(string action)
    {
        var parts = (action ?? string.Empty).Split('/');
        if (parts.Length > 2)
            return parts[^2];
        return string.Empty;
    }
}
