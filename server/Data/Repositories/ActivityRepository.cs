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

    public async Task<Activity?> GetByIdAsync(Guid id)
    {
        return await dbContext.Activities.Include(x => x.Properties).FirstOrDefaultAsync(x => x.Id == id);
    }
}
