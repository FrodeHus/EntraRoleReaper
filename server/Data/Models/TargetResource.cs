namespace EntraRoleReaper.Api.Data.Models;

public class TargetResource : Entity
{
    public required string ResourceType { get; set; }
    public string? DisplayName { get; set; }

    public string? Description { get; set; }

    public virtual ICollection<TargetResourceProperty> Properties { get; init; } = [];
}
