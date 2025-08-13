using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data;

public class ReaperDbContext(DbContextOptions<ReaperDbContext> options) : DbContext(options)
{
    public DbSet<RoleDefinition> RoleDefinitions { get; set; } = null!;
    public DbSet<ResourceAction> ResourceActions { get; set; } = null!;
    public DbSet<PermissionSet> PermissionSets { get; set; } = null!;
}
