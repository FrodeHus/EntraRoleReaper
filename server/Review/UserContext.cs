namespace EntraRoleReaper.Api.Review;

public class UserContext
{
    public required object UserId { get; set; }
    public required Guid TenantId { get; set; }
    public string? DisplayName { get; set; }
    public List<string> ActiveRoleIds { get; set; } = [];
    public List<string> EligibleRoleIds { get; set; } = [];
    public HashSet<string> PimActiveRoleIds { get; set; } = [];
}
