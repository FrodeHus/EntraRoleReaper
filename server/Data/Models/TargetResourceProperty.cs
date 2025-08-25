using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

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
