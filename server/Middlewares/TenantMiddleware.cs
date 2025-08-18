using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Api.Middlewares;

public class TenantMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantService tenantService, ILogger<TenantMiddleware> logger)
    {
        Guid? resolvedTenantId = null;
        
        var claim = context.User?.FindFirst("tid")
                    ?? context.User?.FindFirst("http://schemas.microsoft.com/identity/claims/tenantid");
        if (claim != null && Guid.TryParse(claim.Value, out var claimTenantGuid))
        {
            resolvedTenantId = claimTenantGuid;
        }

        context.Items["TenantId"] = resolvedTenantId; // Guid? (null if unauthenticated or claim missing)
        if (resolvedTenantId.HasValue)
        {
            await tenantService.GetCurrentTenantAsync();

        }
        await next(context);
    }

}