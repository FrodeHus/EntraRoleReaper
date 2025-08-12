using EntraRoleReaper.Api.Configuration.PermissionMapping.Models;
using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;

namespace RoleReaper.Services;

public interface IOperationMappingService
{
    Task<IReadOnlyList<OperationMap>> ExportAsync(CancellationToken ct = default);
    Task<OperationImportResult> ImportAsync(
        IEnumerable<OperationMap> maps,
        CancellationToken ct = default
    );
}

public class OperationImportResult
{
    public int Created { get; init; }
    public int PropertyCreated { get; init; }
    public int TotalOperations { get; init; }
    public int Removed { get; init; }
    public IReadOnlyList<string> UnknownActions { get; init; } = Array.Empty<string>();
}

public class OperationMappingService(CacheDbContext db, IOperationMapCache opCache)
    : IOperationMappingService
{
    public async Task<IReadOnlyList<OperationMap>> ExportAsync(CancellationToken ct = default)
    {
        var opMaps = await db.OperationMaps.Include(o => o.ResourceActions).ToListAsync(ct);
        var propMaps = await db
            .OperationPropertyMaps.Include(p => p.ResourceActions)
            .ToListAsync(ct);

        var allNames = new HashSet<string>(
            opMaps.Select(o => o.OperationName).Concat(propMaps.Select(p => p.OperationName)),
            StringComparer.OrdinalIgnoreCase
        );

        var list = new List<OperationMap>(allNames.Count);
        foreach (var name in allNames.OrderBy(n => n, StringComparer.OrdinalIgnoreCase))
        {
            var opEntity = opMaps.FirstOrDefault(o =>
                o.OperationName.Equals(name, StringComparison.OrdinalIgnoreCase)
            );
            var baseActions = new HashSet<string>(
                (opEntity?.ResourceActions ?? new List<ResourceActionEntity>())
                    .Select(a => a.Action)
                    .Distinct(StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase
            );

            var actionToProps = new Dictionary<string, HashSet<string>>(
                StringComparer.OrdinalIgnoreCase
            );
            foreach (
                var row in propMaps.Where(p =>
                    p.OperationName.Equals(name, StringComparison.OrdinalIgnoreCase)
                )
            )
            {
                foreach (var ra in row.ResourceActions)
                {
                    if (!actionToProps.TryGetValue(ra.Action, out var set))
                    {
                        set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        actionToProps[ra.Action] = set;
                    }
                    set.Add(row.PropertyName);
                }
            }

            var props = actionToProps
                .OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                .Select(kv => new PropertyMap { ResourceAction = kv.Key, Properties = kv.Value })
                .ToList();

            list.Add(
                new OperationMap
                {
                    Operation = name,
                    ResourceActions = baseActions,
                    Properties = props,
                }
            );
        }
        return list;
    }

    public async Task<OperationImportResult> ImportAsync(
        IEnumerable<OperationMap> maps,
        CancellationToken ct = default
    )
    {
        var mapList =
            maps?.Where(m => m != null && !string.IsNullOrWhiteSpace(m.Operation)).ToList()
            ?? new();

        // Wipe existing
        var existingOps = await db.OperationMaps.Include(o => o.ResourceActions).ToListAsync(ct);
        var existingProps = await db
            .OperationPropertyMaps.Include(p => p.ResourceActions)
            .ToListAsync(ct);
        int removed = existingOps.Count + existingProps.Count;
        if (removed > 0)
        {
            db.OperationMaps.RemoveRange(existingOps);
            db.OperationPropertyMaps.RemoveRange(existingProps);
            await db.SaveChangesAsync(ct);
        }

        // Collect operations and property mappings
        var operations = new List<(string Name, IEnumerable<string> Actions)>(mapList.Count);
        var propMappings =
            new List<(string Operation, string Property, IEnumerable<string> Actions)>();
        var allActionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var op in mapList)
        {
            var baseActs =
                op.ResourceActions?.Where(a => !string.IsNullOrWhiteSpace(a))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList() ?? new List<string>();
            foreach (var a in baseActs)
                allActionNames.Add(a);
            operations.Add((op.Operation.Trim(), baseActs));

            // Invert property maps: we have (ResourceAction -> set of properties). Need property -> set of actions.
            var propertyAggregates = new Dictionary<string, HashSet<string>>(
                StringComparer.OrdinalIgnoreCase
            );
            if (op.Properties != null)
            {
                foreach (var pm in op.Properties)
                {
                    if (pm == null || string.IsNullOrWhiteSpace(pm.ResourceAction))
                        continue;
                    var action = pm.ResourceAction.Trim();
                    allActionNames.Add(action);
                    foreach (var propName in pm.Properties ?? [])
                    {
                        if (string.IsNullOrWhiteSpace(propName))
                            continue;
                        if (!propertyAggregates.TryGetValue(propName.Trim(), out var set))
                        {
                            set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                            propertyAggregates[propName.Trim()] = set;
                        }
                        set.Add(action);
                    }
                }
            }
            foreach (var kv in propertyAggregates)
            {
                propMappings.Add(
                    (
                        op.Operation.Trim(),
                        kv.Key,
                        kv.Value.OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
                    )
                );
            }
        }

        // Resolve actions
        var actionEntities = await db
            .ResourceActions.Where(a => allActionNames.Contains(a.Action))
            .ToListAsync(ct);
        var actionLookup = actionEntities.ToDictionary(
            a => a.Action,
            a => a,
            StringComparer.OrdinalIgnoreCase
        );
        var unknownActions = allActionNames
            .Where(a => !actionLookup.ContainsKey(a))
            .OrderBy(a => a)
            .ToList();

        int created = 0;
        int propertyCreated = 0;
        foreach (var op in operations)
        {
            var entity = new OperationMapEntity { OperationName = op.Name };
            foreach (var act in op.Actions.Where(a => actionLookup.ContainsKey(a)))
                entity.ResourceActions.Add(actionLookup[act]);
            db.OperationMaps.Add(entity);
            created++;
        }
        foreach (var pm in propMappings)
        {
            var entity = new OperationPropertyMapEntity
            {
                OperationName = pm.Operation,
                PropertyName = pm.Property,
            };
            foreach (var act in pm.Actions.Where(a => actionLookup.ContainsKey(a)))
                entity.ResourceActions.Add(actionLookup[act]);
            db.OperationPropertyMaps.Add(entity);
            propertyCreated++;
        }
        await db.SaveChangesAsync(ct);
        await opCache.RefreshAsync();

        return new OperationImportResult
        {
            Created = created,
            PropertyCreated = propertyCreated,
            TotalOperations = created,
            Removed = removed,
            UnknownActions = unknownActions,
        };
    }
}
