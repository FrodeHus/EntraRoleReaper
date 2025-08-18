using EntraRoleReaper.Api.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Data.Repositories;

public interface ITenantRepository
{
    Task<Tenant> AddAsync(Tenant tenant);
    Task<Tenant?> GetByIdAsync(Guid id);
    Task<Tenant?> GetByNameAsync(string name);
    Task<IEnumerable<Tenant>> GetAllTenantsAsync();
    Task ClearAsync();
}

public class TenantRepository(ReaperDbContext dbContext, ILogger<TenantRepository> logger) : ITenantRepository
{
    private readonly ILogger<TenantRepository> _logger = logger;

    public async Task<Tenant> AddAsync(Tenant tenant)
    {
        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync();
        return tenant;
    }

    public async Task<Tenant?> GetByIdAsync(Guid id)
    {
        return await dbContext.Tenants.FindAsync(id);
    }

    public async Task<Tenant?> GetByNameAsync(string name)
    {
        return await dbContext.Tenants.FirstOrDefaultAsync(t => t.Name == name);
    }

    public async Task<IEnumerable<Tenant>> GetAllTenantsAsync()
    {
        return await dbContext.Tenants.ToListAsync();
    }

    public async Task ClearAsync()
    {
        dbContext.Tenants.RemoveRange(dbContext.Tenants);
        await dbContext.SaveChangesAsync();
    }
}