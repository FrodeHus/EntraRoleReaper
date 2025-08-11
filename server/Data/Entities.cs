using System;
using Microsoft.EntityFrameworkCore;

namespace RoleReaper.Data;

[Index(nameof(Key), IsUnique = true)]
public class MetaEntity
{
    public string Key { get; set; } = string.Empty;
    public string? StringValue { get; set; }
    public DateTimeOffset? DateValue { get; set; }
}

public class RoleDefinitionEntity
{
    public string Id { get; set; } = string.Empty;
    public string Json { get; set; } = string.Empty;
}

public class ResourceActionEntity
{
    public string Action { get; set; } = string.Empty;
    public bool IsPrivileged { get; set; }
}
