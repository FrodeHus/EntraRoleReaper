using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Repositories;

public class ActivityRepository(ReaperDbContext dbContext) : Repository<Activity>(dbContext), IActivityRepository
{
    public async Task<Activity> AddAsync(Activity activity, bool allowUpdate = true)
    {
        ArgumentNullException.ThrowIfNull(activity);
        var existing = await dbSet.Include(a => a.TargetResources)
            .Include(a => a.MappedResourceActions)
            .FirstOrDefaultAsync(a => activity.Name == a.Name);
        if (existing != null)
        {
            if (!allowUpdate) return existing;
            existing.UpdatedUtc = DateTime.UtcNow;
            existing.IsExcluded = activity.IsExcluded;
            existing.AuditCategory = activity.AuditCategory;
            existing.Service = activity.Service;

            var newMappedActions = activity
                .MappedResourceActions.Where(x =>
                    existing.MappedResourceActions.All(e => e.Id != x.Id)
                )
                .ToList();
            newMappedActions.ForEach(a => existing.MappedResourceActions.Add(a));
            Update(existing);
            return existing;
        }

        Add(activity);
        return activity;
    }

    public async Task<Activity?> GetByNameAsync(string name)
    {
        return await dbSet
            .Include(x => x.TargetResources)
            .FirstOrDefaultAsync(x => x.Name == name);
    }

    public async Task<IEnumerable<Activity>> GetAllActivitiesAsync()
    {
        return await Get(null, x => x.OrderBy(a => a.Name), "TargetResources,MappedResourceActions");
    }

    public async Task ClearAsync()
    {
        dbContext.Activities.RemoveRange(await GetAllActivitiesAsync());
    }

    public async Task<Activity?> GetByIdAsync(Guid id)
    {
        return await GetById(id);
    }




    public async Task SetExclusionAsync(string activityName, bool isExcluded)
    {
        var activity = await GetByNameAsync(activityName);
        if (activity is null)
            return;
        activity.IsExcluded = isExcluded;
        Update(activity);
    }

    public async Task<IEnumerable<Activity>> GetExcludedActivitiesAsync()
    {
        return await dbSet.Where(x => x.IsExcluded).ToListAsync();
    }

    public async Task<IEnumerable<Activity>> GetActivitiesByNamesAsync(
        IEnumerable<string> activityNames,
        bool includeExcluded = false
    )
    {
        if (activityNames?.Any() != true)
        {
            return [];
        }

        return await Get(x => activityNames.Contains(x.Name) || (includeExcluded && x.IsExcluded), null, "TargetResources,MappedResourceActions");
    }
}
