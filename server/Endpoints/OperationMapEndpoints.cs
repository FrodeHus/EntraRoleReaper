using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using RoleReaper.Data;
using RoleReaper.Services;

namespace RoleReaper.Endpoints;

public static class OperationMapEndpoints
{
    public static IEndpointRouteBuilder MapOperationMap(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/operations/map", async (
            int? page,
            int? pageSize,
            string? sort,
            string? dir,
            string? search,
            CacheDbContext db,
            HttpRequest req,
            HttpResponse res) =>
        {
            var p = page.GetValueOrDefault(1);
            var ps = pageSize.GetValueOrDefault(50);
            if (p < 1) p = 1;
            if (ps < 1) ps = 1;
            if (ps > 500) ps = 500;
            var q = db.OperationMaps.AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                q = q.Where(o => o.OperationName.Contains(term) || o.ResourceActions.Any(a => a.Action.Contains(term)));
            }
            var total = await q.CountAsync();
            var sortKey = string.IsNullOrWhiteSpace(sort) ? "operationName" : sort.ToLowerInvariant();
            var asc = string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase) ? false : true;
            q = sortKey switch
            {
                "actions" => asc ? q.OrderBy(o => o.ResourceActions.Count).ThenBy(o => o.OperationName) : q.OrderByDescending(o => o.ResourceActions.Count).ThenBy(o => o.OperationName),
                _ => asc ? q.OrderBy(o => o.OperationName) : q.OrderByDescending(o => o.OperationName),
            };
            var skip = (p - 1) * ps;
            var items = await q.Skip(skip).Take(ps).Select(o => new
            {
                o.Id,
                o.OperationName,
                Actions = o.ResourceActions.Select(a => new { a.Id, a.Action, a.IsPrivileged })
            }).ToListAsync();
            var meta = await db.Meta.AsNoTracking().SingleOrDefaultAsync(m => m.Key == "last_updated");
            var ticks = meta?.DateValue?.UtcTicks ?? 0L;
            var etagValue = $"opmap:{ticks}:{total}:{sortKey}:{asc}:{search}";
            var etagHeader = '"' + etagValue + '"';
            var ifNoneMatch = req.Headers.IfNoneMatch.FirstOrDefault();
            if (!string.IsNullOrEmpty(ifNoneMatch) && string.Equals(ifNoneMatch, etagHeader, StringComparison.Ordinal))
            {
                return Results.StatusCode(304);
            }
            res.Headers.ETag = etagHeader;
            static string BuildLink(HttpRequest req, int page, int pageSize)
            {
                var qb = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(req.QueryString.Value ?? "");
                var dict = qb.ToDictionary(k => k.Key, v => v.Value.ToString(), StringComparer.OrdinalIgnoreCase);
                dict["page"] = page.ToString();
                dict["pageSize"] = pageSize.ToString();
                var qs = string.Join("&", dict.Select(kv => Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value)));
                return req.Path + (qs.Length > 0 ? "?" + qs : string.Empty);
            }
            var totalPages = (int)Math.Ceiling(total / (double)ps);
            List<string> links = new();
            if (totalPages > 0)
            {
                links.Add($"<{BuildLink(req, 1, ps)}>; rel=\"first\"");
                links.Add($"<{BuildLink(req, totalPages, ps)}>; rel=\"last\"");
                if (p > 1) links.Add($"<{BuildLink(req, p - 1, ps)}>; rel=\"prev\"");
                if (p < totalPages) links.Add($"<{BuildLink(req, p + 1, ps)}>; rel=\"next\"");
                if (links.Count > 0) res.Headers.Link = string.Join(", ", links);
            }
            return Results.Ok(new { total, page = p, pageSize = ps, totalPages, items });
        }).RequireAuthorization();

        // Get details for a single operation mapping including all resource actions (mapped first)
        app.MapGet("/api/operations/map/{operationName}", async (string operationName, CacheDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(operationName)) return Results.BadRequest();
            var op = await db.OperationMaps
                .Include(o => o.ResourceActions)
                .SingleOrDefaultAsync(o => o.OperationName == operationName);
            var mappedIds = new HashSet<int>(op?.ResourceActions.Select(a => a.Id) ?? []);
            var all = await db.ResourceActions
                .Select(a => new { a.Id, a.Action, a.IsPrivileged })
                .ToListAsync();
            var allSorted = all
                .OrderBy(a => mappedIds.Contains(a.Id) ? 0 : 1)
                .ThenBy(a => a.Action)
                .ToList();
            var mapped = op != null
                ? op.ResourceActions.Select(a => (object)new { a.Id, a.Action, a.IsPrivileged }).ToList()
                : new List<object>();
            return Results.Ok(new
            {
                operationName,
                exists = op != null,
                mapped,
                all = allSorted
            });
        }).RequireAuthorization();

        // Upsert (create or update) an operation mapping with a set of resource action IDs
        app.MapPut(
                "/api/operations/map/{operationName}",
                async (
                    string operationName,
                    int[] actionIds,
                    CacheDbContext db,
                    IOperationMapCache opCache
                ) =>
        {
            if (string.IsNullOrWhiteSpace(operationName)) return Results.BadRequest();
            var distinctIds = actionIds?.Distinct().ToArray() ?? Array.Empty<int>();
            var op = await db.OperationMaps
                .Include(o => o.ResourceActions)
                .SingleOrDefaultAsync(o => o.OperationName == operationName);
            if (op == null)
            {
                op = new RoleReaper.Data.OperationMapEntity { OperationName = operationName };
                db.OperationMaps.Add(op);
            }
            // Load the target actions
            var actions = await db.ResourceActions
                .Where(a => distinctIds.Contains(a.Id))
                .ToListAsync();
            // Replace mapping
            op.ResourceActions.Clear();
            foreach (var a in actions)
                op.ResourceActions.Add(a);
            await db.SaveChangesAsync();
            var mappedIds = new HashSet<int>(op.ResourceActions.Select(a => a.Id));
            var all = await db.ResourceActions
                .Select(a => new { a.Id, a.Action, a.IsPrivileged })
                .ToListAsync();
            var allSorted = all
                .OrderBy(a => mappedIds.Contains(a.Id) ? 0 : 1)
                .ThenBy(a => a.Action)
                .ToList();
                    // Refresh in-memory cache so subsequent reviews use updated mapping
                    await opCache.RefreshAsync();
            return Results.Ok(new
            {
                operationName = op.OperationName,
                exists = true,
                mapped = op.ResourceActions.Select(a => new { a.Id, a.Action, a.IsPrivileged }),
                all = allSorted
            });
        }).RequireAuthorization();

        // Batch existence check: body is array of operation names, returns array of { operationName, exists, mappedCount }
        app.MapPost("/api/operations/map/existence", async (string[] names, CacheDbContext db) =>
        {
            names ??= Array.Empty<string>();
            var set = new HashSet<string>(names.Where(n => !string.IsNullOrWhiteSpace(n)), StringComparer.OrdinalIgnoreCase);
            if (set.Count == 0) return Results.Ok(Array.Empty<object>());
            var existing = await db.OperationMaps
                .Where(o => set.Contains(o.OperationName))
                .Select(o => new { o.OperationName, Count = o.ResourceActions.Count })
                .ToListAsync();
            var map = existing.ToDictionary(e => e.OperationName, e => e.Count, StringComparer.OrdinalIgnoreCase);
            var response = set.Select(n => new { operationName = n, exists = map.ContainsKey(n), mappedCount = map.GetValueOrDefault(n, 0) }).ToList();
            return Results.Ok(response);
        }).RequireAuthorization();

        // Export operation & property-level mappings.
        // Format per operation key:
        //  - If only operation-level actions exist (no property maps): ["action", ...] (legacy compatible)
        //  - If property maps exist (with or without operation-level actions):
        //      { "actions": ["action", ...], "properties": { "PropertyName": ["action", ...], ... } }
        app.MapGet("/api/operations/map/export", async (CacheDbContext db) =>
        {
            var opMaps = await db.OperationMaps
                .Include(o => o.ResourceActions)
                .ToListAsync();
            var propMaps = await db.OperationPropertyMaps
                .Include(p => p.ResourceActions)
                .ToListAsync();

            var allOperationNames = new HashSet<string>(
                opMaps.Select(o => o.OperationName).Concat(propMaps.Select(p => p.OperationName)),
                StringComparer.OrdinalIgnoreCase);

            var result = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var opName in allOperationNames.OrderBy(n => n, StringComparer.OrdinalIgnoreCase))
            {
                var opEntity = opMaps.FirstOrDefault(o => o.OperationName.Equals(opName, StringComparison.OrdinalIgnoreCase));
                var propGroup = propMaps
                    .Where(p => p.OperationName.Equals(opName, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(p => p.PropertyName)
                    .ToList();
                var opActions = (opEntity?.ResourceActions ?? new List<ResourceActionEntity>())
                    .OrderBy(a => a.Action)
                    .Select(a => a.Action)
                    .ToList();
                if (propGroup.Count == 0)
                {
                    // Legacy simple array form
                    result[opName] = opActions;
                }
                else
                {
                    var propObj = propGroup.ToDictionary(
                        p => p.PropertyName,
                        p => (IEnumerable<string>)p.ResourceActions.OrderBy(a => a.Action).Select(a => a.Action).ToList(),
                        StringComparer.OrdinalIgnoreCase);
                    result[opName] = new
                    {
                        actions = opActions, // can be empty
                        properties = propObj
                    };
                }
            }
            return Results.Ok(result);
        }).RequireAuthorization();

        // Import (upsert) mappings. Accepts legacy { "Op": ["action", ...] } or new format { "Op": { actions: [..], properties: { Prop: [..] } } }
        app.MapPost("/api/operations/map/import", async (JsonElement payload, CacheDbContext db, IOperationMapCache opCache) =>
        {
            if (payload.ValueKind != JsonValueKind.Object)
                return Results.BadRequest(new { error = "Root must be an object" });

            // Wipe existing operation & property mappings
            var existingOps = await db.OperationMaps.Include(o => o.ResourceActions).ToListAsync();
            var existingProps = await db.OperationPropertyMaps.Include(p => p.ResourceActions).ToListAsync();
            int removed = existingOps.Count + existingProps.Count;
            if (removed > 0)
            {
                db.OperationMaps.RemoveRange(existingOps);
                db.OperationPropertyMaps.RemoveRange(existingProps);
                await db.SaveChangesAsync();
            }

            var allActionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var operations = new List<(string Name, IEnumerable<string> Actions)>();
            var propMappings = new List<(string Operation, string Property, IEnumerable<string> Actions)>();

            foreach (var prop in payload.EnumerateObject())
            {
                var opName = prop.Name.Trim();
                if (string.IsNullOrWhiteSpace(opName)) continue;
                if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    var acts = prop.Value.EnumerateArray()
                        .Where(e => e.ValueKind == JsonValueKind.String)
                        .Select(e => e.GetString()!.Trim())
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    foreach (var a in acts) allActionNames.Add(a);
                    operations.Add((opName, acts));
                }
                else if (prop.Value.ValueKind == JsonValueKind.Object)
                {
                    var obj = prop.Value;
                    List<string> opActs = new();
                    if (obj.TryGetProperty("actions", out var actionsElem) && actionsElem.ValueKind == JsonValueKind.Array)
                    {
                        opActs = actionsElem.EnumerateArray()
                            .Where(e => e.ValueKind == JsonValueKind.String)
                            .Select(e => e.GetString()!.Trim())
                            .Where(s => !string.IsNullOrWhiteSpace(s))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
                            .ToList();
                        foreach (var a in opActs) allActionNames.Add(a);
                    }
                    if (obj.TryGetProperty("properties", out var propsElem) && propsElem.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var p in propsElem.EnumerateObject())
                        {
                            var propName = p.Name.Trim();
                            if (string.IsNullOrWhiteSpace(propName)) continue;
                            if (p.Value.ValueKind != JsonValueKind.Array) continue;
                            var pActs = p.Value.EnumerateArray()
                                .Where(e => e.ValueKind == JsonValueKind.String)
                                .Select(e => e.GetString()!.Trim())
                                .Where(s => !string.IsNullOrWhiteSpace(s))
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
                                .ToList();
                            foreach (var a in pActs) allActionNames.Add(a);
                            propMappings.Add((opName, propName, pActs));
                        }
                    }
                    operations.Add((opName, opActs));
                }
            }

            // Load existing actions only once
            var actionEntities = await db.ResourceActions
                .Where(a => allActionNames.Contains(a.Action))
                .ToListAsync();
            var actionLookup = actionEntities.ToDictionary(a => a.Action, a => a, StringComparer.OrdinalIgnoreCase);
            var unknownActions = allActionNames.Where(a => !actionLookup.ContainsKey(a)).OrderBy(a => a).ToList();

            int created = 0;
            int propertyCreated = 0;
            foreach (var op in operations)
            {
                var entity = new RoleReaper.Data.OperationMapEntity { OperationName = op.Name };
                foreach (var act in op.Actions.Where(a => actionLookup.ContainsKey(a)))
                    entity.ResourceActions.Add(actionLookup[act]);
                db.OperationMaps.Add(entity);
                created++;
            }
            foreach (var pm in propMappings)
            {
                var entity = new OperationPropertyMapEntity { OperationName = pm.Operation, PropertyName = pm.Property };
                foreach (var act in pm.Actions.Where(a => actionLookup.ContainsKey(a)))
                    entity.ResourceActions.Add(actionLookup[act]);
                db.OperationPropertyMaps.Add(entity);
                propertyCreated++;
            }
            await db.SaveChangesAsync();
            await opCache.RefreshAsync();
            return Results.Ok(new
            {
                created,
                propertyCreated,
                totalOperations = created,
                removed,
                unknownActions
            });
        }).RequireAuthorization();

            // Property-level mapping endpoints
            app.MapGet("/api/operations/map/{operationName}/properties", async (string operationName, CacheDbContext db) =>
            {
                if (string.IsNullOrWhiteSpace(operationName)) return Results.BadRequest();
                var rows = await db.OperationPropertyMaps
                    .Where(p => p.OperationName == operationName)
                    .Include(p => p.ResourceActions)
                    .ToListAsync();
                var result = rows
                    .OrderBy(r => r.PropertyName)
                    .Select(r => new
                    {
                        r.Id,
                        r.PropertyName,
                        actions = r.ResourceActions.Select(a => new { a.Id, a.Action, a.IsPrivileged }).OrderBy(a => a.Action).ToList()
                    });
                return Results.Ok(result);
            }).RequireAuthorization();

            app.MapPut("/api/operations/map/{operationName}/properties/{propertyName}", async (string operationName, string propertyName, int[] actionIds, CacheDbContext db, IOperationMapCache opCache) =>
            {
                if (string.IsNullOrWhiteSpace(operationName) || string.IsNullOrWhiteSpace(propertyName)) return Results.BadRequest();
                var entity = await db.OperationPropertyMaps
                    .Include(p => p.ResourceActions)
                    .SingleOrDefaultAsync(p => p.OperationName == operationName && p.PropertyName == propertyName);
                if (entity == null)
                {
                    entity = new OperationPropertyMapEntity { OperationName = operationName, PropertyName = propertyName };
                    db.OperationPropertyMaps.Add(entity);
                }
                var distinct = actionIds?.Distinct().ToArray() ?? Array.Empty<int>();
                var actions = await db.ResourceActions.Where(a => distinct.Contains(a.Id)).ToListAsync();
                entity.ResourceActions.Clear();
                foreach (var a in actions) entity.ResourceActions.Add(a);
                await db.SaveChangesAsync();
                await opCache.RefreshAsync();
                return Results.Ok(new
                {
                    entity.OperationName,
                    entity.PropertyName,
                    actions = entity.ResourceActions.Select(a => new { a.Id, a.Action, a.IsPrivileged })
                });
            }).RequireAuthorization();

            app.MapDelete("/api/operations/map/{operationName}/properties/{propertyName}", async (string operationName, string propertyName, CacheDbContext db, IOperationMapCache opCache) =>
            {
                var entity = await db.OperationPropertyMaps.SingleOrDefaultAsync(p => p.OperationName == operationName && p.PropertyName == propertyName);
                if (entity == null) return Results.NotFound();
                db.OperationPropertyMaps.Remove(entity);
                await db.SaveChangesAsync();
                await opCache.RefreshAsync();
                return Results.NoContent();
            }).RequireAuthorization();
        return app;
    }
}
