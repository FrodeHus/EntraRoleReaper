namespace EntraRoleReaper.Api.Review;

public class UserContext
{
    public required object UserId { get; set; }
    public required Guid TenantId { get; set; }
}
