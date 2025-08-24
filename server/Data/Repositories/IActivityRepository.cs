using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;

public interface IActivityRepository
{
    Task<Activity> AddAsync(Activity activity, bool allowUpdate = true);
    Task<Activity?> GetByIdAsync(Guid id);
    Task<Activity?> GetByNameAsync(string name);
    Task<IEnumerable<Activity>> GetAllActivitiesAsync();
    Task ClearAsync();

    Task SetExclusionAsync(string activityName, bool isExcluded);
    Task<IEnumerable<Activity>> GetExcludedActivitiesAsync();
    Task<IEnumerable<Activity>> GetActivitiesByNamesAsync(IEnumerable<string> activityNames, bool includeExcluded = false);
    Task UpdateAsync(Activity existing);
}
