using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;

public class TargetResourceRepository(ReaperDbContext context)
{
    public Repository<TargetResource> TargetResources = new(context);
    public Repository<TargetResourceProperty> TargetResourceProperties = new(context);

    public Task Save() => context.SaveChangesAsync();
}
