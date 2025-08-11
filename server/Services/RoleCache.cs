using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using RoleReaper.Data;

namespace RoleReaper.Services;

public class RoleCache(
    IGraphServiceFactory factory,
    IMemoryCache cache,
    ILogger<RoleCache> logger,
    CacheDbContext db
) : IRoleCache
{
    private const string CacheKey = "RoleDefinitions";
    private const string ActionMapKey = "ActionPrivilegeMap";
    private const string RoleStatsKey = "RolePrivilegeStats";
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);

    public async Task InitializeAsync(bool forceRefresh = false)
    {
        if (cache.TryGetValue(CacheKey, out _) && !forceRefresh)
            return;

        // Try load from DB if not forcing and data is fresh
        if (!forceRefresh)
        {
            var (fromDbDefs, fromDbActions, lastUpdated) = await LoadFromDbAsync();
            if (fromDbDefs.Count > 0 && fromDbActions.Count > 0 && lastUpdated.HasValue)
            {
                if (DateTimeOffset.UtcNow - lastUpdated.Value < MaxAge)
                {
                    SetInMemory(fromDbDefs, fromDbActions);
                    return;
                }
            }
        }

        // Otherwise fetch fresh
        await RefreshAsync();
    }

    public async Task RefreshAsync()
    {
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

        // Persist to DB
        try
        {
            await SaveToDbAsync(definitions, actionPrivilege);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to persist role cache to sqlite");
        }
    }

    public async Task<DateTimeOffset?> GetLastUpdatedAsync()
    {
        var meta = await db.Meta.AsNoTracking().SingleOrDefaultAsync(m => m.Key == "last_updated");
        if (meta?.DateValue != null)
            return meta.DateValue;
        if (meta?.StringValue is string s && long.TryParse(s, out var ticks))
            return new DateTimeOffset(ticks, TimeSpan.Zero);
        return null;
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

        var resourceNamespaces = await graph.RoleManagement.Directory.ResourceNamespaces.GetAsync();
        foreach (var ns in resourceNamespaces?.Value ?? [])
        {
            if (string.IsNullOrWhiteSpace(ns?.Name))
                continue;

            // Page through all resource actions for the namespace
            var resourceActions = await graph
                .RoleManagement.Directory.ResourceNamespaces[ns.Name]
                .ResourceActions.GetAsync();

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

    private void SetInMemory(
        Dictionary<string, UnifiedRoleDefinition> definitions,
        Dictionary<string, bool> actionPrivilege
    )
    {
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

    private static UnifiedRoleDefinition DeserializeRoleDefinition(string json)
    {
        return JsonSerializer.Deserialize<UnifiedRoleDefinition>(json)
            ?? new UnifiedRoleDefinition();
    }

    private async Task SaveToDbAsync(
        Dictionary<string, UnifiedRoleDefinition> definitions,
        Dictionary<string, bool> actionPrivilege
    )
    {
        // Clear old rows
        await db.RoleDefinitions.ExecuteDeleteAsync();
        await db.ResourceActions.ExecuteDeleteAsync();

        // Insert role definitions
        foreach (var (id, def) in definitions)
        {
            db.RoleDefinitions.Add(
                new RoleDefinitionEntity { Id = id, Json = JsonSerializer.Serialize(def) }
            );
        }

        // Insert resource actions
        foreach (var (action, privileged) in actionPrivilege)
        {
            db.ResourceActions.Add(
                new ResourceActionEntity { Action = action, IsPrivileged = privileged }
            );
        }

        // Upsert meta
        var meta = await db.Meta.SingleOrDefaultAsync(m => m.Key == "last_updated");
        if (meta == null)
        {
            meta = new MetaEntity { Key = "last_updated", DateValue = DateTimeOffset.UtcNow };
            db.Meta.Add(meta);
        }
        else
        {
            meta.DateValue = DateTimeOffset.UtcNow;
            meta.StringValue = null;
        }

        await db.SaveChangesAsync();
    }

    private async Task<(
        Dictionary<string, UnifiedRoleDefinition>,
        Dictionary<string, bool>,
        DateTimeOffset?
    )> LoadFromDbAsync()
    {
        var defs = new Dictionary<string, UnifiedRoleDefinition>();
        var actions = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        DateTimeOffset? lastUpdated = null;

        var meta = await db.Meta.AsNoTracking().SingleOrDefaultAsync(m => m.Key == "last_updated");
        lastUpdated = meta?.DateValue;
        if (lastUpdated == null && meta?.StringValue is string s && long.TryParse(s, out var ticks))
            lastUpdated = new DateTimeOffset(ticks, TimeSpan.Zero);

        var roleRows = await db.RoleDefinitions.AsNoTracking().ToListAsync();
        foreach (var row in roleRows)
        {
            if (!string.IsNullOrWhiteSpace(row.Id))
            {
                var def = JsonSerializer.Deserialize<UnifiedRoleDefinition>(row.Json);
                if (def != null)
                    defs[row.Id] = def;
            }
        }

        var actionRows = await db.ResourceActions.AsNoTracking().ToListAsync();
        foreach (var row in actionRows)
        {
            actions[row.Action] = row.IsPrivileged;
        }

        return (defs, actions, lastUpdated);
    }
}
