using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Services.Models;

public class AuditActivity
{
    public required string ActivityName { get; set; }
    public List<ReviewTargetResource> TargetResources { get; set; } = [];
}
