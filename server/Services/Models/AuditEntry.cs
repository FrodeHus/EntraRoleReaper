namespace EntraRoleReaper.Api.Services.Models;

public class AuditActivity
{
    public required string ActivityName { get; set; }
    public List<AuditTargetResource> TargetResources { get; set; } = [];
}

public class AuditTargetResource
{
    public required string Id { get; set; }
    public required string Type { get; set; }
    public required string DisplayName { get; set; }
    public IReadOnlyList<ModifiedProperty>? ModifiedProperties { get; set; }
}