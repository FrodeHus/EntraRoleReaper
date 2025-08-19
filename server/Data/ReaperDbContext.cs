using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data;

public class ReaperDbContext(DbContextOptions<ReaperDbContext> options) : DbContext(options)
{
    public DbSet<RoleDefinition> RoleDefinitions { get; set; }
    public DbSet<ResourceAction> ResourceActions { get; set; }
    public DbSet<PermissionSet> PermissionSets { get; set; }
    public DbSet<Activity> Activities { get; set; }
    public DbSet<ActivityProperty> ActivityProperties { get; set; }
    public DbSet<Tenant> Tenants { get; set; }
    
}
