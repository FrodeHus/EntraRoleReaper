using System.Text.Json;
using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api.Endpoints;

public static class ActionsEndpoints
{
    public static IEndpointRouteBuilder MapActions(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/actions/privileged/refresh", async (IGraphServiceFactory factory, CacheDbContext db) =>
        {
            var client = await factory.CreateForUserAsync();
            var resourceNamespaces = await client.RoleManagement.Directory.ResourceNamespaces.GetAsync();
            var actionLookup = await db.ResourceActions.ToDictionaryAsync(a => a.Action, a => a, StringComparer.OrdinalIgnoreCase);
            foreach (var ns in resourceNamespaces?.Value ?? [])
            {
                if (string.IsNullOrWhiteSpace(ns?.Name)) continue;
                var resourceActions = await client.RoleManagement.Directory.ResourceNamespaces[ns.Name].ResourceActions.GetAsync();
                foreach (var ra in resourceActions?.Value ?? [])
                {
                    var name = ra?.Name;
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    bool isPriv = false;
                    if (ra?.AdditionalData != null && ra.AdditionalData.TryGetValue("isPrivileged", out var raw))
                    {
                        if (raw is bool b) isPriv = b;
                        else if (raw is string s && bool.TryParse(s, out var pb)) isPriv = pb;
                        else if (raw is JsonElement je) isPriv = je.ValueKind == JsonValueKind.True;
                    }
                    if (actionLookup.TryGetValue(name, out var existing)) existing.IsPrivileged = isPriv;
                }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { updated = true });
        }).RequireAuthorization();

        // Incremental search for resource actions by substring, limited result set
        app.MapGet(
                "/api/actions/search",
                async (string q, int? limit, CacheDbContext db) =>
                {
                    if (string.IsNullOrWhiteSpace(q))
                        return Results.Ok(Array.Empty<object>());
                    var term = q.Trim();
                    var take = limit.GetValueOrDefault(30);
                    if (take < 1)
                        take = 1;
                    if (take > 200)
                        take = 200;
                    IQueryable<ResourceActionEntity> raq = db.ResourceActions;
                    if (term.Contains('*'))
                    {
                        var pattern = term.Replace('*', '%').ToLowerInvariant();
                        raq = raq.Where(a => EF.Functions.Like(a.Action.ToLower(), pattern));
                    }
                    else
                    {
                        raq = raq.Where(a => a.Action.Contains(term));
                    }
                    var items = await raq
                        .OrderBy(a => a.Action)
                        .Take(take)
                        .Select(a => new
                        {
                            a.Id,
                            a.Action,
                            a.IsPrivileged,
                        })
                        .ToListAsync();
                    return Results.Ok(items);
                }
            )
            .RequireAuthorization();

        // List resource actions with count of roles using them (paged)
        app.MapGet(
                "/api/actions/usage",
                async (
                    int? page,
                    int? pageSize,
                    string? search,
                    string? sort,
                    string? dir,
                    string? privileged,
                    CacheDbContext db
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
                    // ResourceAction no longer has direct RoleDefinitions navigation; derive via RolePermissions
                    var q = db.ResourceActions.AsQueryable();
                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var term = search.Trim();
                        if (term.Contains('*'))
                        {
                            var pattern = term.Replace('*', '%').ToLowerInvariant();
                            q = q.Where(a => EF.Functions.Like(a.Action.ToLower(), pattern));
                        }
                        else
                        {
                            q = q.Where(a => a.Action.Contains(term));
                        }
                    }
                    if (!string.IsNullOrWhiteSpace(privileged))
                    {
                        var pv = privileged.Trim().ToLowerInvariant();
                        if (pv is "yes" or "true" or "1")
                            q = q.Where(a => a.IsPrivileged);
                        else if (pv is "no" or "false" or "0")
                            q = q.Where(a => !a.IsPrivileged);
                    }
                    var total = await q.CountAsync();
                    var sortKey = string.IsNullOrWhiteSpace(sort)
                        ? "action"
                        : sort.Trim().ToLowerInvariant();
                    var asc = !string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
                    // We'll project to include role usage for sorting when needed
                    // Materialize minimal set for paging after sorting
                    if (sortKey == "roles")
                    {
                        // Sort by number of roles using the action
                        q = asc
                            ? q.OrderBy(a =>
                                    db.RolePermissions.Count(rp =>
                                        rp.ResourceActions.Any(ra => ra.Id == a.Id)
                                    )
                                )
                                .ThenBy(a => a.Action)
                            : q.OrderByDescending(a =>
                                    db.RolePermissions.Count(rp =>
                                        rp.ResourceActions.Any(ra => ra.Id == a.Id)
                                    )
                                )
                                .ThenBy(a => a.Action);
                    }
                    else if (sortKey == "privileged")
                    {
                        q = asc
                            ? q.OrderBy(a => a.IsPrivileged).ThenBy(a => a.Action)
                            : q.OrderByDescending(a => a.IsPrivileged).ThenBy(a => a.Action);
                    }
                    else
                    {
                        q = asc ? q.OrderBy(a => a.Action) : q.OrderByDescending(a => a.Action);
                    }
                    var skip = (p - 1) * ps;
                    var projected = await q.Skip(skip)
                        .Take(ps)
                        .Select(a => new
                        {
                            a.Id,
                            a.Action,
                            a.IsPrivileged,
                            roleCount = db.RolePermissions.Count(rp =>
                                rp.ResourceActions.Any(ra => ra.Id == a.Id)
                            ),
                            // TODO: Reintroduce detailed roles list if needed after navigation refactor
                        })
                        .ToListAsync();
                    var totalPages = (int)Math.Ceiling(total / (double)ps);
                    return Results.Ok(
                        new
                        {
                            total,
                            page = p,
                            pageSize = ps,
                            totalPages,
                            sort = sortKey,
                            asc,
                            privileged,
                            items = projected,
                        }
                    );
                }
            )
            .RequireAuthorization();
        return app;
    }
}
