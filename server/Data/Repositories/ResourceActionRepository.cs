using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public class ResourceActionRepository(ReaperDbContext dbContext) : IResourceActionRepository
{
    public async Task<ResourceAction> AddAsync(ResourceAction resourceAction)
    {
        if (resourceAction == null) throw new ArgumentNullException(nameof(resourceAction));

        dbContext.ResourceActions.Add(resourceAction);
        await dbContext.SaveChangesAsync();
        return resourceAction;
    }

    public async Task<ResourceAction?> GetResourceActionByNameAsync(string name)
    {
        return await dbContext.ResourceActions.FirstOrDefaultAsync(x => x.Action == name);
    }

    public async Task<ResourceAction?> GetResourceActionByIdAsync(Guid id)
    {
        return await dbContext.ResourceActions.FirstOrDefaultAsync(x => x.Id == id);
    }

}
