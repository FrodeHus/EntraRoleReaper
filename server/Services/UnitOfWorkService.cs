using EntraRoleReaper.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Services;

public abstract class UnitOfWorkService(ReaperDbContext dbContext, ILogger logger)
{
    protected async Task SaveChangesAsync()
    {
        try
        {
            await dbContext.SaveChangesAsync();
        }catch(DbUpdateException e){
            logger.LogError(e.InnerException?.Message ?? e.Message);
            foreach (var entry in e.Entries)
            {
                logger.LogDebug("Entity of type {EntityType} in state {EntityState} could not be updated", entry.Entity.GetType().Name, entry.State);
            }
        }
    }
}