using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class ActivityProperty
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    [MaxLength(255)]
    public required string Name { get; init; }

    public virtual ICollection<ResourceAction> MappedResourceActions { get; init; } = [];

}
