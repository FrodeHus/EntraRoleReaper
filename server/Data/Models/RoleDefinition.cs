using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Models;

[Index(nameof(DisplayName), IsUnique = true)]
public class RoleDefinition
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public bool IsBuiltIn { get; set; }
    public virtual List<PermissionSet> PermissionSets { get; set; } = new();
}
