using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Models;

[Index(nameof(ResourceType), IsUnique = true)]
public class TargetResource : Entity
{
    [MaxLength(32)]
    public required string ResourceType { get; set; }

    public virtual ICollection<TargetResourceProperty> Properties { get; init; } = [];
    public virtual ICollection<Activity> Activities { get; init; } = [];
}
