namespace EntraRoleReaper.Api.Data.Models;

public class TargetResourceProperty : Entity
{
    public required string PropertyName { get; set; }
    public bool IsSensitive { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public Guid TargetResourceId { get; set; }
    public TargetResource? TargetResource { get; set; }
}
