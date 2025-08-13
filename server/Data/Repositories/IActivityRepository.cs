using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;

public interface IActivityRepository
{
    Task<Activity> AddAsync(Activity activity);
    Task<Activity?> GetByIdAsync(Guid id);
    Task<Activity?> GetByNameAsync(string name);
}
