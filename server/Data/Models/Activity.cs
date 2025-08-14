using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class Activity
{
    public Guid Id { get; init; }
    [MaxLength(255)]
    public required string Name { get; init; }
    public bool IsExcluded { get; set; } 

    public virtual ICollection<ActivityProperty> Properties { get; init; } = [];
    public virtual ICollection<ResourceAction> MappedResourceActions { get; init; } = [];
}
