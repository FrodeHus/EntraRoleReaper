namespace EntraRoleReaper.Api.Data.Models;

public class Activity
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public ICollection<ActivityProperty>? Properties { get; set; }
    public ICollection<ResourceAction>? MappedResourceActions { get; set; }
}
