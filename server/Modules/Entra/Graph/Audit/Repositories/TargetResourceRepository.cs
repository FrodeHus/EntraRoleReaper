using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

namespace EntraRoleReaper.Api.Data.Repositories;

public class TargetResourceRepository(ReaperDbContext context) : Repository<TargetResource>(context)
{

    public Task Save() => context.SaveChangesAsync();
}
