using Microsoft.EntityFrameworkCore;

namespace RoleReaper.Data;

public class CacheDbContext(DbContextOptions<CacheDbContext> options) : DbContext(options)
{
    public DbSet<RoleDefinitionEntity> RoleDefinitions => Set<RoleDefinitionEntity>();
    public DbSet<ResourceActionEntity> ResourceActions => Set<ResourceActionEntity>();
    public DbSet<MetaEntity> Meta => Set<MetaEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoleDefinitionEntity>(b =>
        {
            b.ToTable("role_definitions");
            b.HasKey(e => e.Id);
            b.Property(e => e.Id).IsRequired();
            b.Property(e => e.Json).IsRequired();
        });

        modelBuilder.Entity<ResourceActionEntity>(b =>
        {
            b.ToTable("resource_actions");
            b.HasKey(e => e.Action);
            b.Property(e => e.Action).IsRequired();
            b.Property(e => e.IsPrivileged).IsRequired();
        });

        modelBuilder.Entity<MetaEntity>(b =>
        {
            b.ToTable("meta");
            b.HasKey(e => e.Key);
            b.Property(e => e.Key).IsRequired();
            b.Property(e => e.StringValue);
            b.Property(e => e.DateValue);
        });
    }
}
