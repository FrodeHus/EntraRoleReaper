using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Models;

[Index(nameof(TargetResourceId), nameof(PropertyName), IsUnique = true)]
public class TargetResourceProperty : Entity
{
    [MaxLength(32)]
    public required string PropertyName { get; set; }
    public bool IsSensitive { get; set; }
    [MaxLength(255)]
    public string? Description { get; set; }
    public Guid TargetResourceId { get; set; }
    public virtual ICollection<ResourceAction> MappedResourceActions { get; set; } = [];
}
