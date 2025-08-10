using Microsoft.Extensions.Caching.Memory;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace EntraRoleAuditor.Services;

public interface IRoleCache
{
    Task InitializeAsync();
    IReadOnlyDictionary<string, UnifiedRoleDefinition> GetAll();
}

public class RoleCache(
    IGraphServiceFactory factory,
    IMemoryCache cache,
    IHttpContextAccessor accessor
) : IRoleCache
{
    private const string CacheKey = "RoleDefinitions";

    public async Task InitializeAsync()
    {
        if (cache.TryGetValue(CacheKey, out _))
            return;
        var token = accessor
            .HttpContext?.Request.Headers["Authorization"]
            .ToString()
            ?.Replace("Bearer ", "");
        if (string.IsNullOrEmpty(token))
            return; // will be populated on first authorized request
        var graph = await factory.CreateForUserAsync(token);

        var definitions = new Dictionary<string, UnifiedRoleDefinition>();
        var page = await graph.RoleManagement.Directory.RoleDefinitions.GetAsync();
        if (page?.Value != null)
        {
            foreach (var d in page.Value)
            {
                if (d?.Id != null)
                    definitions[d.Id] = d;
            }
        }
        cache.Set(CacheKey, definitions, TimeSpan.FromHours(1));
    }

    public IReadOnlyDictionary<string, UnifiedRoleDefinition> GetAll()
    {
        if (
            cache.TryGetValue(CacheKey, out Dictionary<string, UnifiedRoleDefinition>? roles)
            && roles != null
        )
        {
            return roles;
        }
        return new Dictionary<string, UnifiedRoleDefinition>();
    }
}
