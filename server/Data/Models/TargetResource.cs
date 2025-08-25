using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class TargetResource : Entity
{
    [MaxLength(32)]
    public required string ResourceType { get; set; }

    public virtual ICollection<TargetResourceProperty> Properties { get; init; } = [];
}
