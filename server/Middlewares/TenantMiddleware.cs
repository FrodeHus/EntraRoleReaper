using EntraRoleReaper.Api.Data.Repositories;

namespace EntraRoleReaper.Api.Middlewares;

public class TenantMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantRepository tenantRepository, ILogger<TenantMiddleware> logger)
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
            var existingTenant = await tenantRepository.GetByIdAsync(resolvedTenantId.Value);
            if (existingTenant == null)
            {
                // If tenant does not exist, create a new one
                existingTenant = new Data.Models.Tenant
                {
                    Id = resolvedTenantId.Value,
                    Name = $"Tenant-{resolvedTenantId.Value}",
                    CreatedAt = DateTime.UtcNow
                };
                
                try
                {
                    await tenantRepository.AddAsync(existingTenant);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error creating tenant with ID {TenantId}", resolvedTenantId.Value);
                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    await context.Response.WriteAsync("An error occurred while creating the tenant.");
                    throw;
                }
            }
            
        }
        await next(context);
    }

}