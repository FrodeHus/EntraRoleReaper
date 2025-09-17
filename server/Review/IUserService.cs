using System.Security.Claims;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;

namespace EntraRoleReaper.Api.Review;

public interface IUserService
{
    Task<UserContext> GetCurrentUser();
    Task<UserContext> GetUserById(string userId, Guid tenantId);
}

public class UserService(IHttpContextAccessor httpContextAccessor, IGraphService graphService) : IUserService
{
    public Task<UserContext> GetCurrentUser()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user == null || user.Identity?.IsAuthenticated == false)
        {
            throw new UnauthorizedAccessException("User is not authenticated.");
        }
        var userId = user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var tenantIdValue = httpContextAccessor.HttpContext?.Items["TenantId"]?.ToString();
        if (string.IsNullOrEmpty(userId))
        {
            throw new UnauthorizedAccessException("User ID claim is missing.");
        }
        var tenantId = string.IsNullOrEmpty(tenantIdValue) ? Guid.Empty : Guid.Parse(tenantIdValue);
        return Task.FromResult(new UserContext
        {
            UserId = userId, TenantId = tenantId
        });
    }

    public async Task<UserContext> GetUserById(string userId, Guid tenantId)
    {
        var userData = await graphService.GetUserAndRolesAsync(userId);
        return new UserContext
        {
            UserId = userId,
            TenantId = tenantId,
            DisplayName = userData.DisplayName,
            ActiveRoleIds = userData.ActiveRoleIds,
            EligibleRoleIds = userData.EligibleRoleIds,
            PimActiveRoleIds = userData.PimActiveRoleIds
        };
    }
}