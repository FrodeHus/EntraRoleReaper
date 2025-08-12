using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;

namespace RoleReaper.Endpoints;

public static class RolesSummaryEndpoints
{
    public static IEndpointRouteBuilder MapRolesSummary(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/roles/summary", async (
            int? page,
            int? pageSize,
            string? sort,
            string? dir,
            string? search,
            bool? privilegedOnly,
            CacheDbContext db,
            HttpRequest req,
            HttpResponse res) =>
        {
            var p = page.GetValueOrDefault(1);
            var ps = pageSize.GetValueOrDefault(50);
            if (p < 1) p = 1;
            if (ps < 1) ps = 1;
            if (ps > 500) ps = 500;
            var q = db.RoleDefinitions.AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                        if (term.Contains('*'))
                        {
                            var pattern = term.Replace('*', '%').ToLowerInvariant();
                            q = q.Where(r => EF.Functions.Like(r.DisplayName.ToLower(), pattern));
                        }
                        else
                        {
                            q = q.Where(r => r.DisplayName.Contains(term));
                        }
            }
            if (privilegedOnly == true)
            {
                        q = q.Where(r =>
                            r.RolePermissions.Any(p => p.ResourceActions.Any(a => a.IsPrivileged))
                        );
            }
            var total = await q.CountAsync();
            var sortKey = string.IsNullOrWhiteSpace(sort) ? "displayName" : sort.ToLowerInvariant();
            var asc = string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase) ? false : true;
            q = sortKey switch
            {
                "builtin" => asc ? q.OrderBy(r => r.IsBuiltIn).ThenBy(r => r.DisplayName) : q.OrderByDescending(r => r.IsBuiltIn).ThenBy(r => r.DisplayName),
                "enabled" => asc ? q.OrderBy(r => r.IsEnabled).ThenBy(r => r.DisplayName) : q.OrderByDescending(r => r.IsEnabled).ThenBy(r => r.DisplayName),
                        "privileged" => asc
                            ? q.OrderBy(r =>
                                    r.RolePermissions.Any(p =>
                                        p.ResourceActions.Any(a => a.IsPrivileged)
                                    )
                                )
                                .ThenBy(r => r.DisplayName)
                            : q.OrderByDescending(r =>
                                    r.RolePermissions.Any(p =>
                                        p.ResourceActions.Any(a => a.IsPrivileged)
                                    )
                                )
                                .ThenBy(r => r.DisplayName),
                _ => asc ? q.OrderBy(r => r.DisplayName) : q.OrderByDescending(r => r.DisplayName),
            };
            var skip = (p - 1) * ps;
            var items = await q.Skip(skip).Take(ps).Select(r => new
            {
                r.Id,
                r.DisplayName,
                r.IsBuiltIn,
                r.IsEnabled,
                r.ResourceScope,
                            Privileged = r.RolePermissions.Any(p =>
                                p.ResourceActions.Any(a => a.IsPrivileged)
                            ),
            }).ToListAsync();
            var meta = await db.Meta.AsNoTracking().SingleOrDefaultAsync(m => m.Key == "last_updated");
            var ticks = meta?.DateValue?.UtcTicks ?? 0L;
            var etagValue = $"roledefs:{ticks}:{total}:{sortKey}:{asc}:{search}:{privilegedOnly}:p{p}:ps{ps}";
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
        return app;
    }
}
