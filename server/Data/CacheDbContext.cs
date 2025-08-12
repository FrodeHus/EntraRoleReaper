using Microsoft.EntityFrameworkCore;

namespace RoleReaper.Data;

public class CacheDbContext(DbContextOptions<CacheDbContext> options) : DbContext(options)
{
    public DbSet<RoleDefinitionEntity> RoleDefinitions => Set<RoleDefinitionEntity>();
    public DbSet<ResourceActionEntity> ResourceActions => Set<ResourceActionEntity>();
    public DbSet<OperationMapEntity> OperationMaps => Set<OperationMapEntity>();
    public DbSet<MetaEntity> Meta => Set<MetaEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoleDefinitionEntity>(b =>
        {
            b.ToTable("role_definitions");
            b.HasKey(e => e.Id);
            b.Property(e => e.Id).IsRequired();
            b.Property(e => e.DisplayName).HasMaxLength(512).IsRequired();
            b.Property(e => e.Description);
            b.Property(e => e.IsBuiltIn).IsRequired();
            b.Property(e => e.IsEnabled).IsRequired();
            b.Property(e => e.ResourceScope).HasMaxLength(512);
        });

        modelBuilder.Entity<ResourceActionEntity>(b =>
        {
            b.ToTable("resource_actions");
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.Action).IsUnique();
            b.Property(e => e.Action).HasMaxLength(512).IsRequired();
            b.Property(e => e.IsPrivileged).IsRequired();
        });

        // Many-to-many RoleDefinition <-> ResourceAction
        modelBuilder
            .Entity<RoleDefinitionEntity>()
            .HasMany(r => r.ResourceActions)
            .WithMany(a => a.RoleDefinitions)
            .UsingEntity<Dictionary<string, object>>(
                "role_definition_actions",
                l => l.HasOne<ResourceActionEntity>().WithMany().HasForeignKey("ResourceActionId"),
                r => r.HasOne<RoleDefinitionEntity>().WithMany().HasForeignKey("RoleDefinitionId")
            );

        modelBuilder.Entity<OperationMapEntity>(b =>
        {
            b.ToTable("operation_map");
            b.HasKey(e => e.Id);
            b.HasIndex(e => e.OperationName).IsUnique();
            b.Property(e => e.OperationName).HasMaxLength(512).IsRequired();
        });

        // Many-to-many OperationMap <-> ResourceAction
        modelBuilder
            .Entity<OperationMapEntity>()
            .HasMany(o => o.ResourceActions)
            .WithMany(a => a.Operations)
            .UsingEntity<Dictionary<string, object>>(
                "operation_resource_actions",
                l => l.HasOne<ResourceActionEntity>().WithMany().HasForeignKey("ResourceActionId"),
                r => r.HasOne<OperationMapEntity>().WithMany().HasForeignKey("OperationMapId")
            );

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
