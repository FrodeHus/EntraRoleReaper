using System.Security.Claims;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Api.Review;

public class UserService(IHttpContextAccessor httpContextAccessor, IGraphService graphService, ICacheService cacheService) : IUserService
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
        var cachedUserContext = cacheService.GetUserContext(userId, tenantId);
        if (cachedUserContext != null)
        {
            return cachedUserContext;
        }
        var userData = await graphService.GetUserAndRolesAsync(userId);
        var userContext = new UserContext
        {
            UserId = userId,
            TenantId = tenantId,
            DisplayName = userData.DisplayName,
            ActiveRoleIds = userData.ActiveRoleIds,
            EligibleRoleIds = userData.EligibleRoleIds,
            PimActiveRoleIds = userData.PimActiveRoleIds
        };
        cacheService.SetUserContext(userContext);
        return userContext;
    }
}