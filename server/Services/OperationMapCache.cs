using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RoleReaper.Data;

namespace RoleReaper.Services;

public class OperationMapCache(CacheDbContext db, IMemoryCache memoryCache, ILogger<OperationMapCache> logger) : IOperationMapCache
{
    private const string CacheKey = "OperationMapCache";
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
            var dict = await db.OperationMaps
                .Include(o => o.ResourceActions)
                .AsNoTracking()
                .ToDictionaryAsync(
                    o => o.OperationName,
                    o => o.ResourceActions
                        .Select(a => a.Action)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(a => a)
                        .ToArray(),
                    StringComparer.OrdinalIgnoreCase);
            memoryCache.Set(CacheKey, dict, Ttl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed refreshing operation map cache");
            memoryCache.Set(CacheKey, new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase), Ttl);
        }
    }

    public IReadOnlyDictionary<string, string[]> GetAll()
    {
        if (memoryCache.TryGetValue(CacheKey, out Dictionary<string, string[]>? dict) && dict != null)
            return dict;
        return new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
    }
}
