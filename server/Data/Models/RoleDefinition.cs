namespace EntraRoleReaper.Api.Data.Models;

public class RoleDefinition
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string RoleType { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public bool IsBuiltIn { get; set; }
    public List<PermissionSet> PermissionSets { get; set; } = new();
}

public class PermissionSet
{
    public Guid Id { get; set; }
    public Guid RoleDefinitionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<string> ResourceActions { get; set; } = new();
    public bool IsPrivileged { get; set; }
    public string? Condition { get; set; }
}

public class ResourceAction
{
    public Guid Id { get; set; }
    public Guid PermissionSetId { get; set; }
    public string Action { get; set; } = string.Empty; // unique
    public bool IsPrivileged { get; set; }
}
