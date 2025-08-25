using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data;

public class ReaperDbContext(DbContextOptions<ReaperDbContext> options, IHttpContextAccessor httpContextAccessor) : DbContext(options)
{
    public DbSet<RoleDefinition> RoleDefinitions { get; set; }
    public DbSet<ResourceAction> ResourceActions { get; set; }
    public DbSet<PermissionSet> PermissionSets { get; set; }
    public DbSet<Activity> Activities { get; set; }
    public DbSet<TargetResource> TargetResources { get; set; }
    public DbSet<TargetResourceProperty> TargetResourceProperties { get; set; }
    public DbSet<Tenant> Tenants { get; set; }
    private Guid TenantId => (Guid?)httpContextAccessor.HttpContext?.Items["TenantId"] ?? Guid.Empty;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoleDefinition>()
            .HasQueryFilter(t => t.TenantId == TenantId || t.TenantId == null);
        base.OnModelCreating(modelBuilder);
    }
}
