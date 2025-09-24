using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

[Index(nameof(Name), IsUnique = true)]
public class Activity : Entity
{
    [MaxLength(255)]
    public required string Name { get; init; }
    [MaxLength(255)]
    public string? AuditCategory { get; set; }
    public string? Service { get; set; }
    public bool IsExcluded { get; set; }

    public virtual ICollection<TargetResource> TargetResources { get; init; } = [];
    public virtual ICollection<ResourceAction> MappedResourceActions { get; init; } = [];
}
