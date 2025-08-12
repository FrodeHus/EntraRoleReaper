using Microsoft.EntityFrameworkCore;

namespace RoleReaper.Data;

public class CacheDbContext(DbContextOptions<CacheDbContext> options) : DbContext(options)
{
    public DbSet<RoleDefinitionEntity> RoleDefinitions => Set<RoleDefinitionEntity>();
    public DbSet<ResourceActionEntity> ResourceActions => Set<ResourceActionEntity>();
    public DbSet<OperationMapEntity> OperationMaps => Set<OperationMapEntity>();
    public DbSet<RolePermissionEntity> RolePermissions => Set<RolePermissionEntity>();
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

        // RoleDefinition now connects to actions through RolePermissionEntity

        modelBuilder.Entity<RolePermissionEntity>(b =>
        {
            b.ToTable("role_permissions");
            b.HasKey(e => e.Id);
            b.Property(e => e.Condition);
            b.HasOne(e => e.RoleDefinition)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(e => e.RoleDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Many-to-many RolePermission <-> ResourceAction
        modelBuilder
            .Entity<RolePermissionEntity>()
            .HasMany(rp => rp.ResourceActions)
            .WithMany()
            .UsingEntity<Dictionary<string, object>>(
                "role_permission_actions",
                l => l.HasOne<ResourceActionEntity>().WithMany().HasForeignKey("ResourceActionId"),
                r => r.HasOne<RolePermissionEntity>().WithMany().HasForeignKey("RolePermissionId")
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
