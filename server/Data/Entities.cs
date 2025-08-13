using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data;

[Index(nameof(Key), IsUnique = true)]
public class MetaEntity
{
    public string Key { get; set; } = string.Empty;
    public string? StringValue { get; set; }
    public DateTimeOffset? DateValue { get; set; }
}

// Normalized role definition (replaces JSON storage)
public class RoleDefinitionEntity
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsBuiltIn { get; set; }
    public bool IsEnabled { get; set; }
    public string? ResourceScope { get; set; }

    // Granular role permissions (as exposed by Graph's UnifiedRolePermission)
    public virtual ICollection<RolePermissionEntity> RolePermissions { get; set; } =
        new List<RolePermissionEntity>();

    [NotMapped]
    public bool IsPrivileged =>
        RolePermissions.Any(p => p.ResourceActions.Any(a => a.IsPrivileged));
}

public class ResourceActionEntity
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty; // unique
    public bool IsPrivileged { get; set; }
    public virtual ICollection<OperationMapEntity> Operations { get; set; } =
        new List<OperationMapEntity>();
}

public class OperationMapEntity
{
    public int Id { get; set; }
    public string OperationName { get; set; } = string.Empty;
    public virtual ICollection<ResourceActionEntity> ResourceActions { get; set; } =
        new List<ResourceActionEntity>();
}

// New: property-level mapping (Operation + PropertyName -> many ResourceActions)
public class OperationPropertyMapEntity
{
    public int Id { get; set; }
    public string OperationName { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public virtual ICollection<ResourceActionEntity> ResourceActions { get; set; } =
        new List<ResourceActionEntity>();
}

public class OperationExclusionEntity
{
    public int Id { get; set; }
    public string OperationName { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}

public class RolePermissionEntity
{
    public int Id { get; set; }
    public string? Condition { get; set; }

    public string RoleDefinitionId { get; set; } = string.Empty;
    public virtual RoleDefinitionEntity? RoleDefinition { get; set; }

    public virtual ICollection<ResourceActionEntity> ResourceActions { get; set; } =
        new List<ResourceActionEntity>();
}
