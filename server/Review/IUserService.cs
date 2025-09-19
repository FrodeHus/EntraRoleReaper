namespace EntraRoleReaper.Api.Review;

public interface IUserService
{
    Task<UserContext> GetCurrentUser();
    Task<UserContext> GetUserById(string userId, Guid tenantId);
}