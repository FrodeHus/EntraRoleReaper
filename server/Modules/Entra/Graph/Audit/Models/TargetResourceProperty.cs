using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

public class TargetResourceProperty : Entity
{
    public required string PropertyName { get; set; }
    public bool IsSensitive { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public Guid TargetResourceId { get; set; }
    public virtual TargetResource? TargetResource { get; set; }
    public virtual ICollection<ResourceAction> MappedResourceActions { get; set; } = [];
}
