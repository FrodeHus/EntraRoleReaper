using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;
using RoleReaper.Services;

namespace RoleReaper.Endpoints;

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
        return app;
    }
}
