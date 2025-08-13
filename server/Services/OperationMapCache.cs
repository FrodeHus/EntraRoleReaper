using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace EntraRoleReaper.Api.Services;

public class OperationMapCache(
    CacheDbContext db,
    IMemoryCache memoryCache,
    ILogger<OperationMapCache> logger
) : IOperationMapCache
{
    private const string CacheKey = "OperationMapCache";
    private const string PropCacheKey = "OperationPropertyMapCache";
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);

    public async Task InitializeAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && memoryCache.TryGetValue(CacheKey, out _))
            return;
        await RefreshAsync();
    }

    public async Task RefreshAsync()
    {
        try
        {
            var dict = await db
                .OperationMaps.Include(o => o.ResourceActions)
                .AsNoTracking()
                .ToDictionaryAsync(
                    o => o.OperationName,
                    o =>
                        o.ResourceActions.Select(a => a.Action)
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderBy(a => a)
                            .ToArray(),
                    StringComparer.OrdinalIgnoreCase
                );
            var prop = await db
                .OperationPropertyMaps.Include(p => p.ResourceActions)
                .AsNoTracking()
                .ToListAsync();
            var propertyMapping = prop
                .GroupBy(p => p.OperationName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    g => g.Key,
                    g =>
                        (IReadOnlyDictionary<string, string[]>)
                        g.ToDictionary(
                            x => x.PropertyName,
                            x =>
                                x.ResourceActions.Select(a => a.Action)
                                    .Distinct(StringComparer.OrdinalIgnoreCase)
                                    .OrderBy(a => a)
                                    .ToArray(),
                            StringComparer.OrdinalIgnoreCase
                        ),
                    StringComparer.OrdinalIgnoreCase
                );
            memoryCache.Set(CacheKey, dict, Ttl);
            memoryCache.Set(PropCacheKey, propertyMapping, Ttl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed refreshing operation map cache");
            memoryCache.Set(
                CacheKey,
                new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase),
                Ttl
            );
            memoryCache.Set(
                PropCacheKey,
                new Dictionary<string, IReadOnlyDictionary<string, string[]>>(
                    StringComparer.OrdinalIgnoreCase
                ),
                Ttl
            );
        }
    }

    public IReadOnlyDictionary<string, string[]> GetAll()
    {
        if (
            memoryCache.TryGetValue(CacheKey, out Dictionary<string, string[]>? dict)
            && dict != null
        )
            return dict;
        return new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyDictionary<string, IReadOnlyDictionary<string, string[]>> GetPropertyMap()
    {
        if (
            memoryCache.TryGetValue(
                PropCacheKey,
                out Dictionary<string, IReadOnlyDictionary<string, string[]>>? dict
            )
            && dict != null
        )
            return dict;
        return new Dictionary<string, IReadOnlyDictionary<string, string[]>>(
            StringComparer.OrdinalIgnoreCase
        );
    }
}