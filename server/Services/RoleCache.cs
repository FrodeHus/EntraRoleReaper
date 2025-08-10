using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace EntraRoleAssignmentAuditor.Services;

public record RolePrivilegeStats(int PrivilegedAllowed, int TotalAllowed);

public interface IRoleCache
{
    Task InitializeAsync();
    IReadOnlyDictionary<string, UnifiedRoleDefinition> GetAll();
    IReadOnlyDictionary<string, bool> GetActionPrivilegeMap();
    IReadOnlyDictionary<string, RolePrivilegeStats> GetRolePrivilegeStats();
}

public class RoleCache(
    IGraphServiceFactory factory,
    IMemoryCache cache,
    IHttpContextAccessor accessor
) : IRoleCache
{
    private const string CacheKey = "RoleDefinitions";
    private const string ActionMapKey = "ActionPrivilegeMap";
    private const string RoleStatsKey = "RolePrivilegeStats";

    public async Task InitializeAsync()
    {
        if (cache.TryGetValue(CacheKey, out _))
            return;
        var graphClient = await factory.CreateForUserAsync();

        Dictionary<string, UnifiedRoleDefinition> definitions = await GetAllRoleDefinitions(
            graphClient
        );

        Dictionary<string, bool> actionPrivilege = await GetAllResourceActions(graphClient);

        // Compute per-role privilege stats
        var roleStats = new Dictionary<string, RolePrivilegeStats>();
        foreach (var kvp in definitions)
        {
            var def = kvp.Value;
            int total = 0;
            int priv = 0;
            if (def.RolePermissions != null)
            {
                foreach (var rp in def.RolePermissions)
                {
                    var allowed = rp.AllowedResourceActions ?? new List<string>();
                    total += allowed.Count;
                    foreach (var ar in allowed)
                    {
                        if (actionPrivilege.TryGetValue(ar, out var p) && p)
                            priv++;
                    }
                }
            }
            roleStats[kvp.Key] = new RolePrivilegeStats(priv, total);
        }

        var ttl = TimeSpan.FromHours(1);
        cache.Set(CacheKey, definitions, ttl);
        cache.Set(ActionMapKey, actionPrivilege, ttl);
        cache.Set(RoleStatsKey, roleStats, ttl);
    }

    private static async Task<Dictionary<string, UnifiedRoleDefinition>> GetAllRoleDefinitions(
        GraphServiceClient graph
    )
    {
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

        return definitions;
    }

    private static async Task<Dictionary<string, bool>> GetAllResourceActions(
        GraphServiceClient graph
    )
    {
        var actionPrivilege = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        var resourceNamespaces =
            await graph.RoleManagement.EntitlementManagement.ResourceNamespaces.GetAsync();
        foreach (var ns in resourceNamespaces?.Value ?? [])
        {
            if (string.IsNullOrWhiteSpace(ns?.Name))
                continue;

            // Page through all resource actions for the namespace
            var raBuilder = graph
                .RoleManagement
                .Directory
                .ResourceNamespaces[ns.Name]
                .ResourceActions;
            var resourceActions = await raBuilder.GetAsync();

            foreach (var resourceAction in resourceActions?.Value ?? [])
            {
                var name = resourceAction?.Name;
                if (string.IsNullOrWhiteSpace(name))
                    continue;

                bool isPrivileged = false;
                if (
                    resourceAction?.AdditionalData != null
                    && resourceAction.AdditionalData.TryGetValue("isPrivileged", out var raw)
                )
                {
                    // Accept bool, string, or JsonElement
                    if (raw is bool b)
                        isPrivileged = b;
                    else if (raw is string s && bool.TryParse(s, out var pb))
                        isPrivileged = pb;
                    else if (raw is JsonElement je)
                    {
                        if (je.ValueKind == JsonValueKind.True)
                            isPrivileged = true;
                        else if (je.ValueKind == JsonValueKind.False)
                            isPrivileged = false;
                    }
                }

                // Normalize action to lower case for consistent mapping
                actionPrivilege[name.ToLowerInvariant()] = isPrivileged;
            }
        }

        return actionPrivilege;
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

    public IReadOnlyDictionary<string, bool> GetActionPrivilegeMap()
    {
        if (cache.TryGetValue(ActionMapKey, out Dictionary<string, bool>? map) && map != null)
            return map;
        return new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyDictionary<string, RolePrivilegeStats> GetRolePrivilegeStats()
    {
        if (
            cache.TryGetValue(RoleStatsKey, out Dictionary<string, RolePrivilegeStats>? stats)
            && stats != null
        )
            return stats;
        return new Dictionary<string, RolePrivilegeStats>();
    }
}
