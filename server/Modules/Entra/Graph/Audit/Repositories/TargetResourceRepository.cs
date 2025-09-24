using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Repositories;

public class TargetResourceRepository(ReaperDbContext context) : Repository<TargetResource>(context)
{

    public Task Save() => context.SaveChangesAsync();
}
