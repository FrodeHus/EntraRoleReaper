using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;

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
        app.MapPut("/api/operations/map/{operationName}", async (string operationName, int[] actionIds, CacheDbContext db) =>
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

        // Export all operation mappings in seed file format (operationName -> [action, ...])
        app.MapGet("/api/operations/map/export", async (CacheDbContext db) =>
        {
            var items = await db.OperationMaps
                .Include(o => o.ResourceActions)
                .OrderBy(o => o.OperationName)
                .Select(o => new
                {
                    o.OperationName,
                    Actions = o.ResourceActions
                        .OrderBy(a => a.Action)
                        .Select(a => a.Action)
                        .ToList()
                })
                .ToListAsync();
            var dict = items.ToDictionary(
                i => i.OperationName,
                i => (object)i.Actions,
                StringComparer.OrdinalIgnoreCase);
            return Results.Ok(dict);
        }).RequireAuthorization();

        // Import (upsert) operation mappings from seed format { "Operation": ["action", ...], ... }
        app.MapPost("/api/operations/map/import", async (Dictionary<string, string[]> payload, CacheDbContext db) =>
        {
            payload ??= new(StringComparer.OrdinalIgnoreCase);
            if (payload.Count == 0) return Results.BadRequest(new { error = "Empty payload" });
            // Clear existing mappings completely so imported file becomes the authoritative set
            var existingMaps = await db.OperationMaps.Include(o => o.ResourceActions).ToListAsync();
            int removed = existingMaps.Count;
            if (removed > 0)
            {
                db.OperationMaps.RemoveRange(existingMaps);
                await db.SaveChangesAsync(); // persist removal early to avoid key conflicts / residual relationships
            }
            // Collect all distinct action names (case-insensitive)
            var allActionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kvp in payload)
            {
                if (string.IsNullOrWhiteSpace(kvp.Key)) continue;
                foreach (var act in kvp.Value ?? Array.Empty<string>())
                    if (!string.IsNullOrWhiteSpace(act)) allActionNames.Add(act.Trim());
            }
            // Load existing actions
            var actionEntities = await db.ResourceActions
                .Where(a => allActionNames.Contains(a.Action))
                .ToListAsync();
            var actionLookup = actionEntities.ToDictionary(a => a.Action, a => a, StringComparer.OrdinalIgnoreCase);
            var unknownActions = allActionNames.Where(a => !actionLookup.ContainsKey(a)).OrderBy(a => a).ToList();
            int created = 0, updated = 0; // updated will remain 0 since we wiped first, but keep field for response consistency
            foreach (var kvp in payload)
            {
                var opName = kvp.Key?.Trim();
                if (string.IsNullOrWhiteSpace(opName)) continue;
                var wanted = (kvp.Value ?? Array.Empty<string>())
                    .Where(a => !string.IsNullOrWhiteSpace(a) && actionLookup.ContainsKey(a))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Select(a => actionLookup[a])
                    .OrderBy(a => a.Action)
                    .ToList();
                var entity = new RoleReaper.Data.OperationMapEntity { OperationName = opName };
                foreach (var act in wanted) entity.ResourceActions.Add(act);
                db.OperationMaps.Add(entity);
                created++;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new
            {
                created,
                updated,
                totalOperations = created + updated,
                removed,
                unknownActions
            });
        }).RequireAuthorization();
        return app;
    }
}
