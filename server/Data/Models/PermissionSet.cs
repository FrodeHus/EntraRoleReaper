using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class PermissionSet
{
    public Guid Id { get; set; }
    public Guid RoleDefinitionId { get; set; }
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    public virtual List<ResourceAction>? ResourceActions { get; set; } = new();
    public bool IsPrivileged { get; set; }
    [MaxLength(30)]
    public string? Condition { get; set; }
}
