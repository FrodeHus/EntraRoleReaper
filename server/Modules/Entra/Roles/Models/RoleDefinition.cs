using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Models;

[Index(nameof(Id), nameof(DisplayName), IsUnique = true)]
public class RoleDefinition : TenantEntity
{
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;
    [MaxLength(255)]
    public string Description { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
    public bool IsBuiltIn { get; set; }
    public virtual List<PermissionSet> PermissionSets { get; set; } = new();
}
