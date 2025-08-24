using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class ActivityRepository(ReaperDbContext dbContext) : IActivityRepository
{
    public async Task<Activity> AddAsync(Activity activity, bool allowUpdate = true)
    {
        ArgumentNullException.ThrowIfNull(activity);
        var existing = await dbContext
            .Activities.Include(a => a.TargetResources)
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
            dbContext.Activities.Update(existing);
            await dbContext.SaveChangesAsync();
            return existing;
        }

        dbContext.Activities.Add(activity);

        await dbContext.SaveChangesAsync();
        return activity;
    }

    public async Task<Activity?> GetByNameAsync(string name)
    {
        return await dbContext
            .Activities.Include(x => x.TargetResources)
            .FirstOrDefaultAsync(x => x.Name == name);
    }

    public async Task<IEnumerable<Activity>> GetAllActivitiesAsync()
    {
        return await dbContext
            .Activities.Include(x => x.TargetResources)
            .Include(x => x.MappedResourceActions)
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public Task ClearAsync()
    {
        dbContext.Activities.RemoveRange(dbContext.Activities);
        return dbContext.SaveChangesAsync();
    }

    public async Task<Activity?> GetByIdAsync(Guid id)
    {
        return await dbContext
            .Activities.Include(x => x.TargetResources)
            .FirstOrDefaultAsync(x => x.Id == id);
    }




    public async Task SetExclusionAsync(string activityName, bool isExcluded)
    {
        var activity = await GetByNameAsync(activityName);
        if (activity is null)
            return;
        activity.IsExcluded = isExcluded;
        dbContext.Activities.Update(activity);
        await dbContext.SaveChangesAsync();
    }

    public async Task<IEnumerable<Activity>> GetExcludedActivitiesAsync()
    {
        return await dbContext.Activities.Where(x => x.IsExcluded).ToListAsync();
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

        return await dbContext
            .Activities.Where(x =>
                activityNames.Contains(x.Name) || (includeExcluded && x.IsExcluded)
            )
            .Include(x => x.TargetResources)
            .Include(x => x.MappedResourceActions)
            .ToListAsync();
    }

    public Task UpdateAsync(Activity existing)
    {
        dbContext.Activities.Update(existing);
        return dbContext.SaveChangesAsync();
    }
}
