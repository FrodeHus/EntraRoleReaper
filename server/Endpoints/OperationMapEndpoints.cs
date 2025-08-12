using System.Text.Json;
using EntraRoleReaper.Api.Configuration.PermissionMapping.Models;
using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;
using RoleReaper.Services;

namespace RoleReaper.Endpoints;

public static class OperationMapEndpoints
{
    public static IEndpointRouteBuilder MapOperationMap(this IEndpointRouteBuilder app)
    {
        // List operations with paging, search, sorting
        app.MapGet(
                "/api/operations/map",
                async (
                    int? page,
                    int? pageSize,
                    string? sort,
                    string? dir,
                    string? search,
                    CacheDbContext db,
                    HttpRequest req,
                    HttpResponse res
                ) =>
                {
                    var p = page.GetValueOrDefault(1);
                    var ps = pageSize.GetValueOrDefault(50);
                    if (p < 1)
                        p = 1;
                    if (ps < 1)
                        ps = 1;
                    if (ps > 500)
                        ps = 500;
                    var q = db.OperationMaps.AsQueryable();
                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var term = search.Trim();
                        if (term.Contains('*'))
                        {
                            var pattern = term.Replace('*', '%');
                            var lp = pattern.ToLowerInvariant();
                            q = q.Where(o =>
                                EF.Functions.Like(o.OperationName.ToLower(), lp)
                                || o.ResourceActions.Any(a =>
                                    EF.Functions.Like(a.Action.ToLower(), lp)
                                )
                            );
                        }
                        else
                        {
                            q = q.Where(o =>
                                o.OperationName.Contains(term)
                                || o.ResourceActions.Any(a => a.Action.Contains(term))
                            );
                        }
                    }
                    var total = await q.CountAsync();
                    var sortKey = string.IsNullOrWhiteSpace(sort)
                        ? "operationName"
                        : sort.ToLowerInvariant();
                    var asc = !string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
                    q = sortKey switch
                    {
                        "actions" => asc
                            ? q.OrderBy(o => o.ResourceActions.Count).ThenBy(o => o.OperationName)
                            : q.OrderByDescending(o => o.ResourceActions.Count)
                                .ThenBy(o => o.OperationName),
                        _ => asc
                            ? q.OrderBy(o => o.OperationName)
                            : q.OrderByDescending(o => o.OperationName),
                    };
                    var skip = (p - 1) * ps;
                    var items = await q.Skip(skip)
                        .Take(ps)
                        .Select(o => new
                        {
                            o.Id,
                            o.OperationName,
                            Actions = o.ResourceActions.Select(a => new
                            {
                                a.Id,
                                a.Action,
                                a.IsPrivileged,
                            }),
                        })
                        .ToListAsync();
                    var meta = await db
                        .Meta.AsNoTracking()
                        .SingleOrDefaultAsync(m => m.Key == "last_updated");
                    var ticks = meta?.DateValue?.UtcTicks ?? 0L;
                    var etagValue = $"opmap:{ticks}:{total}:{sortKey}:{asc}:{search}";
                    var etagHeader = '"' + etagValue + '"';
                    var ifNone = req.Headers.IfNoneMatch.FirstOrDefault();
                    if (
                        !string.IsNullOrEmpty(ifNone)
                        && string.Equals(ifNone, etagHeader, StringComparison.Ordinal)
                    )
                        return Results.StatusCode(304);
                    res.Headers.ETag = etagHeader;
                    static string BuildLink(HttpRequest r, int page, int size)
                    {
                        var qb = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(
                            r.QueryString.Value ?? ""
                        );
                        var dict = qb.ToDictionary(
                            k => k.Key,
                            v => v.Value.ToString(),
                            StringComparer.OrdinalIgnoreCase
                        );
                        dict["page"] = page.ToString();
                        dict["pageSize"] = size.ToString();
                        var qs = string.Join(
                            '&',
                            dict.Select(kv =>
                                Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value)
                            )
                        );
                        return r.Path + (qs.Length > 0 ? "?" + qs : string.Empty);
                    }
                    var totalPages = (int)Math.Ceiling(total / (double)ps);
                    if (totalPages > 0)
                    {
                        var links = new List<string>();
                        links.Add($"<{BuildLink(req, 1, ps)}>; rel=\"first\"");
                        links.Add($"<{BuildLink(req, totalPages, ps)}>; rel=\"last\"");
                        if (p > 1)
                            links.Add($"<{BuildLink(req, p - 1, ps)}>; rel=\"prev\"");
                        if (p < totalPages)
                            links.Add($"<{BuildLink(req, p + 1, ps)}>; rel=\"next\"");
                        if (links.Count > 0)
                            res.Headers.Link = string.Join(", ", links);
                    }
                    return Results.Ok(
                        new
                        {
                            total,
                            page = p,
                            pageSize = ps,
                            totalPages,
                            items,
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Single operation details
        app.MapGet(
                "/api/operations/map/{operationName}",
                async (string operationName, CacheDbContext db) =>
                {
                    if (string.IsNullOrWhiteSpace(operationName))
                        return Results.BadRequest();
                    var op = await db
                        .OperationMaps.Include(o => o.ResourceActions)
                        .SingleOrDefaultAsync(o => o.OperationName == operationName);
                    var mappedIds = new HashSet<int>(op?.ResourceActions.Select(a => a.Id) ?? []);
                    var all = await db
                        .ResourceActions.Select(a => new
                        {
                            a.Id,
                            a.Action,
                            a.IsPrivileged,
                        })
                        .ToListAsync();
                    var allSorted = all.OrderBy(a => mappedIds.Contains(a.Id) ? 0 : 1)
                        .ThenBy(a => a.Action)
                        .ToList();
                    var mapped =
                        op?.ResourceActions.Select(a => new
                            {
                                a.Id,
                                a.Action,
                                a.IsPrivileged,
                            })
                            .Cast<object>()
                            .ToList() ?? new List<object>();
                    return Results.Ok(
                        new
                        {
                            operationName,
                            exists = op != null,
                            mapped,
                            all = allSorted,
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Upsert base mapping
        app.MapPut(
                "/api/operations/map/{operationName}",
                async (
                    string operationName,
                    int[] actionIds,
                    CacheDbContext db,
                    IOperationMapCache cache
                ) =>
                {
                    if (string.IsNullOrWhiteSpace(operationName))
                        return Results.BadRequest();
                    var dIds = actionIds?.Distinct().ToArray() ?? Array.Empty<int>();
                    var op = await db
                        .OperationMaps.Include(o => o.ResourceActions)
                        .SingleOrDefaultAsync(o => o.OperationName == operationName);
                    if (op == null)
                    {
                        op = new OperationMapEntity { OperationName = operationName };
                        db.OperationMaps.Add(op);
                    }
                    var acts = await db
                        .ResourceActions.Where(a => dIds.Contains(a.Id))
                        .ToListAsync();
                    op.ResourceActions.Clear();
                    foreach (var a in acts)
                        op.ResourceActions.Add(a);
                    await db.SaveChangesAsync();
                    await cache.RefreshAsync();
                    var mapped = op.ResourceActions.Select(a => new
                    {
                        a.Id,
                        a.Action,
                        a.IsPrivileged,
                    });
                    var all = await db
                        .ResourceActions.Select(a => new
                        {
                            a.Id,
                            a.Action,
                            a.IsPrivileged,
                        })
                        .ToListAsync();
                    var allSorted = all.OrderBy(a => mapped.Any(m => m.Id == a.Id) ? 0 : 1)
                        .ThenBy(a => a.Action);
                    return Results.Ok(
                        new
                        {
                            operationName = op.OperationName,
                            exists = true,
                            mapped,
                            all = allSorted,
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Batch existence
        app.MapPost(
                "/api/operations/map/existence",
                async (string[] names, CacheDbContext db) =>
                {
                    names ??= Array.Empty<string>();
                    var set = new HashSet<string>(
                        names.Where(n => !string.IsNullOrWhiteSpace(n)),
                        StringComparer.OrdinalIgnoreCase
                    );
                    if (set.Count == 0)
                        return Results.Ok(Array.Empty<object>());
                    var existing = await db
                        .OperationMaps.Where(o => set.Contains(o.OperationName))
                        .Select(o => new { o.OperationName, Count = o.ResourceActions.Count })
                        .ToListAsync();
                    var map = existing.ToDictionary(
                        e => e.OperationName,
                        e => e.Count,
                        StringComparer.OrdinalIgnoreCase
                    );
                    var response = set.Select(n => new
                        {
                            operationName = n,
                            exists = map.ContainsKey(n),
                            mappedCount = map.GetValueOrDefault(n, 0),
                        })
                        .ToList();
                    return Results.Ok(response);
                }
            )
            .RequireAuthorization();

        // Export (new format list)
        app.MapGet(
                "/api/operations/map/export",
                async (IOperationMappingService svc) =>
                {
                    var list = await svc.ExportAsync();
                    return Results.Ok(list);
                }
            )
            .RequireAuthorization();

        // Import (new format only)
        app.MapPost(
                "/api/operations/map/import",
                async (JsonElement payload, IOperationMappingService svc) =>
                {
                    if (payload.ValueKind != JsonValueKind.Array)
                        return Results.BadRequest(new { error = "Expected JSON array" });
                    var maps =
                        new List<EntraRoleReaper.Api.Configuration.PermissionMapping.Models.OperationMap>();
                    foreach (var el in payload.EnumerateArray())
                    {
                        if (el.ValueKind != JsonValueKind.Object)
                            continue;
                        if (
                            !el.TryGetProperty("Operation", out var opElem)
                            || opElem.ValueKind != JsonValueKind.String
                        )
                            continue;
                        var opName = opElem.GetString();
                        if (string.IsNullOrWhiteSpace(opName))
                            continue;
                        var actions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        if (
                            el.TryGetProperty("ResourceActions", out var raElem)
                            && raElem.ValueKind == JsonValueKind.Array
                        )
                        {
                            foreach (var a in raElem.EnumerateArray())
                                if (
                                    a.ValueKind == JsonValueKind.String
                                    && !string.IsNullOrWhiteSpace(a.GetString())
                                )
                                    actions.Add(a.GetString()!);
                        }
                        var props = new List<PropertyMap>();
                        if (
                            el.TryGetProperty("Properties", out var propsElem)
                            && propsElem.ValueKind == JsonValueKind.Array
                        )
                        {
                            foreach (var pmEl in propsElem.EnumerateArray())
                            {
                                if (pmEl.ValueKind != JsonValueKind.Object)
                                    continue;
                                if (
                                    !pmEl.TryGetProperty("ResourceAction", out var raNameElem)
                                    || raNameElem.ValueKind != JsonValueKind.String
                                )
                                    continue;
                                var raName = raNameElem.GetString();
                                if (string.IsNullOrWhiteSpace(raName))
                                    continue;
                                var propNames = new HashSet<string>(
                                    StringComparer.OrdinalIgnoreCase
                                );
                                if (
                                    pmEl.TryGetProperty("Properties", out var arrProps)
                                    && arrProps.ValueKind == JsonValueKind.Array
                                )
                                {
                                    foreach (var pne in arrProps.EnumerateArray())
                                        if (
                                            pne.ValueKind == JsonValueKind.String
                                            && !string.IsNullOrWhiteSpace(pne.GetString())
                                        )
                                            propNames.Add(pne.GetString()!);
                                }
                                props.Add(
                                    new PropertyMap
                                    {
                                        ResourceAction = raName!,
                                        Properties = propNames,
                                    }
                                );
                            }
                        }
                        maps.Add(
                            new OperationMap
                            {
                                Operation = opName!,
                                ResourceActions = actions,
                                Properties = props,
                            }
                        );
                    }
                    var result = await svc.ImportAsync(maps);
                    return Results.Ok(
                        new
                        {
                            created = result.Created,
                            propertyCreated = result.PropertyCreated,
                            totalOperations = result.TotalOperations,
                            removed = result.Removed,
                            unknownActions = result.UnknownActions,
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Property maps list
        app.MapGet(
                "/api/operations/map/{operationName}/properties",
                async (string operationName, CacheDbContext db) =>
                {
                    if (string.IsNullOrWhiteSpace(operationName))
                        return Results.BadRequest();
                    var rows = await db
                        .OperationPropertyMaps.Where(p => p.OperationName == operationName)
                        .Include(p => p.ResourceActions)
                        .ToListAsync();
                    var result = rows.OrderBy(r => r.PropertyName)
                        .Select(r => new
                        {
                            r.Id,
                            r.PropertyName,
                            actions = r
                                .ResourceActions.Select(a => new
                                {
                                    a.Id,
                                    a.Action,
                                    a.IsPrivileged,
                                })
                                .OrderBy(a => a.Action)
                                .ToList(),
                        });
                    return Results.Ok(result);
                }
            )
            .RequireAuthorization();

        // Upsert property map
        app.MapPut(
                "/api/operations/map/{operationName}/properties/{propertyName}",
                async (
                    string operationName,
                    string propertyName,
                    int[] actionIds,
                    CacheDbContext db,
                    IOperationMapCache cache
                ) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(operationName)
                        || string.IsNullOrWhiteSpace(propertyName)
                    )
                        return Results.BadRequest();
                    var entity = await db
                        .OperationPropertyMaps.Include(p => p.ResourceActions)
                        .SingleOrDefaultAsync(p =>
                            p.OperationName == operationName && p.PropertyName == propertyName
                        );
                    if (entity == null)
                    {
                        entity = new OperationPropertyMapEntity
                        {
                            OperationName = operationName,
                            PropertyName = propertyName,
                        };
                        db.OperationPropertyMaps.Add(entity);
                    }
                    var dIds = actionIds?.Distinct().ToArray() ?? Array.Empty<int>();
                    var acts = await db
                        .ResourceActions.Where(a => dIds.Contains(a.Id))
                        .ToListAsync();
                    entity.ResourceActions.Clear();
                    foreach (var a in acts)
                        entity.ResourceActions.Add(a);
                    await db.SaveChangesAsync();
                    await cache.RefreshAsync();
                    return Results.Ok(
                        new
                        {
                            entity.OperationName,
                            entity.PropertyName,
                            actions = entity.ResourceActions.Select(a => new
                            {
                                a.Id,
                                a.Action,
                                a.IsPrivileged,
                            }),
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Delete property map
        app.MapDelete(
                "/api/operations/map/{operationName}/properties/{propertyName}",
                async (
                    string operationName,
                    string propertyName,
                    CacheDbContext db,
                    IOperationMapCache cache
                ) =>
                {
                    var entity = await db.OperationPropertyMaps.SingleOrDefaultAsync(p =>
                        p.OperationName == operationName && p.PropertyName == propertyName
                    );
                    if (entity == null)
                        return Results.NotFound();
                    db.OperationPropertyMaps.Remove(entity);
                    await db.SaveChangesAsync();
                    await cache.RefreshAsync();
                    return Results.NoContent();
                }
            )
            .RequireAuthorization();

        // Exclusions create
        app.MapPost(
                "/api/operations/exclusions",
                async (OperationExclusionCreateRequest req, CacheDbContext db) =>
                {
                    if (req == null || string.IsNullOrWhiteSpace(req.OperationName))
                        return Results.BadRequest();
                    var name = req.OperationName.Trim();
                    var existing = await db.OperationExclusions.SingleOrDefaultAsync(e =>
                        e.OperationName == name
                    );
                    if (existing != null)
                        return Results.Ok(
                            new
                            {
                                existing.Id,
                                existing.OperationName,
                                existing.CreatedUtc,
                            }
                        );
                    var entity = new OperationExclusionEntity { OperationName = name };
                    db.OperationExclusions.Add(entity);
                    await db.SaveChangesAsync();
                    return Results.Ok(
                        new
                        {
                            entity.Id,
                            entity.OperationName,
                            entity.CreatedUtc,
                        }
                    );
                }
            )
            .RequireAuthorization();

        // Exclusions list
        app.MapGet(
                "/api/operations/exclusions",
                async (CacheDbContext db) =>
                {
                    var list = await db
                        .OperationExclusions.OrderBy(e => e.OperationName)
                        .Select(e => new
                        {
                            e.Id,
                            e.OperationName,
                            e.CreatedUtc,
                        })
                        .ToListAsync();
                    return Results.Ok(list);
                }
            )
            .RequireAuthorization();

        // Exclusions delete
        app.MapDelete(
                "/api/operations/exclusions/{operationName}",
                async (string operationName, CacheDbContext db) =>
                {
                    var entity = await db.OperationExclusions.SingleOrDefaultAsync(e =>
                        e.OperationName == operationName
                    );
                    if (entity == null)
                        return Results.NotFound();
                    db.OperationExclusions.Remove(entity);
                    await db.SaveChangesAsync();
                    return Results.NoContent();
                }
            )
            .RequireAuthorization();

        // Export exclusions
        app.MapGet(
                "/api/operations/exclusions/export",
                async (CacheDbContext db) =>
                {
                    var list = await db
                        .OperationExclusions.OrderBy(e => e.OperationName)
                        .Select(e => e.OperationName)
                        .ToListAsync();
                    return Results.Ok(list);
                }
            )
            .RequireAuthorization();

        // Import exclusions (replace all)
        app.MapPost(
                "/api/operations/exclusions/import",
                async (string[] names, CacheDbContext db) =>
                {
                    names ??= Array.Empty<string>();
                    var distinct = names
                        .Where(n => !string.IsNullOrWhiteSpace(n))
                        .Select(n => n.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    var existing = await db.OperationExclusions.ToListAsync();
                    int removed = existing.Count;
                    if (removed > 0)
                    {
                        db.OperationExclusions.RemoveRange(existing);
                        await db.SaveChangesAsync();
                    }
                    foreach (var n in distinct)
                        db.OperationExclusions.Add(
                            new OperationExclusionEntity { OperationName = n }
                        );
                    await db.SaveChangesAsync();
                    return Results.Ok(
                        new
                        {
                            created = distinct.Count,
                            removed,
                            total = distinct.Count,
                        }
                    );
                }
            )
            .RequireAuthorization();

        return app;
    }
}

public record OperationExclusionCreateRequest(string? OperationName);
