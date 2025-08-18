using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;

namespace EntraRoleReaper.Api.Services;

public class TenantService(
    ITenantRepository tenantRepository,
    IGraphService graphService,
    IHttpContextAccessor httpContextAccessor,
    ILogger<TenantService> logger)
    : ITenantService
{

    public async Task<Tenant?> GetCurrentTenantAsync(bool refresh = false, CancellationToken ct = default)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            logger.LogDebug("No HttpContext; cannot resolve tenant");
            return null;
        }

        if (httpContext.Items.TryGetValue("TenantId", out var tenantObj) && tenantObj is Guid tenantId)
        {
            var existing = await tenantRepository.GetByIdAsync(tenantId);
            if (existing != null && !refresh)
            {
                return existing;
            }

            try
            {
                var tenant = await graphService.FetchTenantMetadataAsync(tenantId, ct);
                if (tenant == null)
                {
                    logger.LogWarning("No tenant metadata found for {TenantId}", tenantId);
                    return null;
                }
                if (existing == null)
                {
                    existing = new Tenant
                    {
                        Id = tenantId,
                        Name = tenant.Name,
                        TenantDomain = tenant.TenantDomain,
                        CreatedAt = DateTime.UtcNow
                    };
                    await tenantRepository.AddAsync(existing);
                }
                else
                {
                    var changed = false;
                    if (!string.Equals(existing.Name, tenant.Name, StringComparison.Ordinal))
                    {
                        existing.Name = tenant.Name;
                        changed = true;
                    }
                    if (!string.Equals(existing.TenantDomain, tenant.TenantDomain, StringComparison.OrdinalIgnoreCase))
                    {
                        existing.TenantDomain = tenant.TenantDomain;
                        changed = true;
                    }
                    if (changed)
                    {
                        await tenantRepository.UpdateAsync(existing);
                    }
                }
                return existing;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed retrieving tenant metadata for {TenantId}", tenantId);
                return existing; // return stale if available
            }
        }
        
        return null;
    }
    
   
}

public interface ITenantService
{
    Task<Tenant?> GetCurrentTenantAsync(bool refresh = false, CancellationToken ct = default);
}