using System.ComponentModel.DataAnnotations;
using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Modules.Entra.Roles.Models;

[Index(nameof(Action), IsUnique = true)]
public class ResourceAction : Entity
{
    [MaxLength(255)]
    public string Action { get; init; } = string.Empty; // unique
    [MaxLength(255)]
    public string? Description { get; init; } = string.Empty;
    [MaxLength(20)]
    public string? ActionVerb { get; init; } = string.Empty;
    public bool IsPrivileged { get; init; }
    public virtual ICollection<PermissionSet> PermissionSets { get; init; } = [];
    public virtual ICollection<TargetResourceProperty> MappedTargetResourceProperties { get; init; } = [];
    public virtual ICollection<Activity> MappedActivities { get; init; } = [];
}
