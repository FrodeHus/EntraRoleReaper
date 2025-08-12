using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace RoleReaper.Data;

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

    // RolePermissions -> collection of allowed resource actions (many-to-many)
    public virtual ICollection<ResourceActionEntity> ResourceActions { get; set; } =
        new List<ResourceActionEntity>();

    [NotMapped]
    public bool IsPrivileged => ResourceActions.Any(a => a.IsPrivileged);
}

public class ResourceActionEntity
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty; // unique
    public bool IsPrivileged { get; set; }

    public virtual ICollection<RoleDefinitionEntity> RoleDefinitions { get; set; } =
        new List<RoleDefinitionEntity>();
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
