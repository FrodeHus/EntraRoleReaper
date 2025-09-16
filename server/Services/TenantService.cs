using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Services;

public class TenantService(
    ITenantRepository tenantRepository,
    IRoleRepository roleRepository,
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

        if (!httpContext.Items.TryGetValue("TenantId", out var tenantObj) || tenantObj is not Guid tenantId)
            return null;
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
                    TenantDomain = tenant.TenantDomain
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
                    existing.UpdatedUtc = DateTime.UtcNow;
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

        return null;
    }
    
    public async Task<TenantMetadataDto> GetCurrentTenantMetadataAsync(CancellationToken ct = default)
    {
        var tenant = await GetCurrentTenantAsync(false, ct);
        if (tenant == null)
        {
            return new TenantMetadataDto(Guid.Empty, "(no tenant)", "(no domain)", 0);
        }

        var customRoles = await roleRepository.GetRoleCountAsync(true);
        return new TenantMetadataDto(tenant.Id, tenant.Name ?? "(no name)", tenant.TenantDomain ?? "(no primary domain)", customRoles);
    }
}

public interface ITenantService
{
    Task<Tenant?> GetCurrentTenantAsync(bool refresh = false, CancellationToken ct = default);
    Task<TenantMetadataDto> GetCurrentTenantMetadataAsync(CancellationToken ct = default);
}