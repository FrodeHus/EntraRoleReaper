using EntraRoleReaper.Api.Data.Models;
using Microsoft.Extensions.Caching.Memory;

namespace EntraRoleReaper.Api.Services;

public class CacheService(IMemoryCache memoryCache, ILogger<CacheService> logger, RoleService roleService) : ICacheService
{
    public async Task InitializeAsync(bool forceRefresh = false)
    {
        logger.LogInformation("Initializing cache service...");
        await roleService.InitializeAsync(forceRefresh);
        var roleDefinitions = await roleService.GetAllRolesAsync();
        if (roleDefinitions.Count == 0)
        {
            logger.LogWarning("No role definitions found to cache.");
            return;
        }
        foreach (var role in roleDefinitions)
        {
            memoryCache.Set(role.Id.ToString(), role, TimeSpan.FromHours(1));
            logger.LogInformation("Cached role: {RoleName} with ID: {RoleId}", role.DisplayName, role.Id);
        }
        
        var resourceActions = roleDefinitions
            .SelectMany(role =>
                role.PermissionSets.Where(ps => ps.ResourceActions is not null)
                    .SelectMany(ps => ps.ResourceActions!.Select(ra => ra.Action)))
            .Distinct()
            .ToList();
        
        Set("ResourceActions", resourceActions, TimeSpan.FromHours(1));
        
        Set("CacheMetadata", new CacheMetadata
        {
            LastUpdated = DateTime.UtcNow,
            RoleCount = roleDefinitions.Count,
            ResourceActionCount = resourceActions.Count
        }, TimeSpan.FromHours(1));
        logger.LogInformation("Cache service initialized successfully.");
    }
    
    public CacheMetadata GetCacheMetadata()
    {
        if (memoryCache.TryGetValue("CacheMetadata", out CacheMetadata? metadata) && metadata is not null)
        {
            logger.LogInformation("Cache metadata retrieved successfully.");
            logger.LogInformation("Last Updated: {LastUpdated}, Role Count: {RoleCount}, Resource Action Count: {ResourceActionCount}",
                metadata.LastUpdated, metadata.RoleCount, metadata.ResourceActionCount);
            return metadata;
        }
        logger.LogWarning("Cache metadata not found, returning default values.");
        return new CacheMetadata
        {
            LastUpdated = null,
            RoleCount = 0,
            ResourceActionCount = 0
        };
    }
    
    public async Task<RoleDefinition?> GetRoleByIdAsync(string roleId)
    {
        if (string.IsNullOrWhiteSpace(roleId))
        {
            throw new ArgumentException("Role ID cannot be null or empty.", nameof(roleId));
        }
        
        var role = Get<RoleDefinition>(roleId);
        if (role is not null)
        {
            return role;
        }
        
        logger.LogWarning("Cache miss for role ID: {RoleId}", roleId);
        role = await roleService.GetRoleByIdAsync(roleId);
        if (role is not null)
        {
            Set(role.Id.ToString(), role, TimeSpan.FromHours(1));
        }
        return role;
    }
    
    private void Set<T>(string key, T value, TimeSpan? expiration = null)
    {
        if (value is null)
        {
            logger.LogWarning("Attempted to cache a null value for key: {Key}", key);
            return;
        }
        
        var cacheEntryOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiration ?? TimeSpan.FromHours(1)
        };
        
        memoryCache.Set(key, value, cacheEntryOptions);
        logger.LogInformation("Cached value for key: {Key}", key);
    }
    
    private T? Get<T>(string key)
    {
        if (memoryCache.TryGetValue(key, out T? value))
        {
            return value;
        }
        logger.LogWarning("Cache miss for key: {Key}", key);
        return default;
    }
}

public class CacheMetadata
{
    public DateTime? LastUpdated { get; set; }
    public int RoleCount { get; set; }
    public int ResourceActionCount { get; set; }
}
public interface ICacheService
{
    Task InitializeAsync(bool forceRefresh = false);
    Task<RoleDefinition?> GetRoleByIdAsync(string roleId);
    CacheMetadata GetCacheMetadata();   
}