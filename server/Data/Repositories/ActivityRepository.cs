using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class ActivityRepository(ReaperDbContext dbContext) : IActivityRepository
{
    public async Task<Activity> AddAsync(Activity activity)
    {
        if (activity is null)
            throw new ArgumentNullException(nameof(activity));

        dbContext.Activities.Add(activity);

        await dbContext.SaveChangesAsync();
        return activity;
    }

    public async Task<Activity?> GetByNameAsync(string name)
    {
        return await dbContext.Activities.Include(x => x.Properties).FirstOrDefaultAsync(x => x.Name == name);
    }

    public async Task<IEnumerable<Activity>> GetAllActivitiesAsync()
    {
        return await dbContext.Activities
            .Include(x => x.Properties)
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
        return await dbContext.Activities.Include(x => x.Properties).FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task DeletePropertyMapAsync(string activityName, string propertyName)
    {
        if (string.IsNullOrWhiteSpace(activityName))
        {
            throw new ArgumentException("Activity name cannot be null or empty.", nameof(activityName));
        }

        if (string.IsNullOrWhiteSpace(propertyName))
        {
            throw new ArgumentException("Property name cannot be null or empty.", nameof(propertyName));
        }

        var activity = await GetByNameAsync(activityName);

        var property = activity?.Properties.FirstOrDefault(p => p.Name == propertyName);
        if (property != null)
        {
            activity?.Properties.Remove(property);
            await dbContext.SaveChangesAsync();
        }
    }

    public async Task AddPropertyMapToActivityAsync(string activityName, string propertyName,
        IEnumerable<Guid> resourceActionIds)
    {
        if (string.IsNullOrWhiteSpace(activityName))
        {
            throw new ArgumentException("Activity name cannot be null or empty.", nameof(activityName));
        }

        if (string.IsNullOrWhiteSpace(propertyName))
        {
            throw new ArgumentException("Property name cannot be null or empty.", nameof(propertyName));
        }

        var activity = await GetByNameAsync(activityName) ?? new Activity
        {
            Name = activityName,
            Properties = new List<ActivityProperty>()
        };

        var property = activity.Properties.FirstOrDefault(p => p.Name == propertyName);
        if (property is null)
        {
            property = new ActivityProperty { Name = propertyName };
            activity.Properties.Add(property);
        }

        foreach (var resourceActionId in resourceActionIds)
        {
            var resourceAction = await dbContext.ResourceActions.FindAsync(resourceActionId);
            if (resourceAction is not null && property.MappedResourceActions.All(a => a.Id != resourceActionId))
            {
                property.MappedResourceActions.Add(resourceAction);
            }
        }

        dbContext.Activities.Update(activity);
        await dbContext.SaveChangesAsync();

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

    public async Task<IEnumerable<Activity>> GetActivitiesByNamesAsync(IEnumerable<string> activityNames)
    {
        if (activityNames?.Any() != true)
        {
            return [];
        }
        return await dbContext.Activities
            .Where(x => activityNames.Contains(x.Name) && !x.IsExcluded)
            .Include(x => x.Properties)
            .Include(x => x.MappedResourceActions)
            .ToListAsync();

    }
}
