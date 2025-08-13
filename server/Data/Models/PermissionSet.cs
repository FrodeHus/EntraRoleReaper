namespace EntraRoleReaper.Api.Data.Models;

public class PermissionSet
{
    public Guid Id { get; set; }
    public Guid RoleDefinitionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<string> ResourceActions { get; set; } = new();
    public bool IsPrivileged { get; set; }
    public string? Condition { get; set; }
}
