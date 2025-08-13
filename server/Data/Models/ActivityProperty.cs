namespace EntraRoleReaper.Api.Data.Models;

public class ActivityProperty
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public required Activity Activity { get; set; }
    public required string Name { get; set; }
    public ICollection<ResourceAction>? MappedResourceActions { get; set; }

}
