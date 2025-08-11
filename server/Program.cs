using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;
using RoleReaper.Data;
using RoleReaper.Services;

var builder = WebApplication.CreateBuilder(args);

// Config
var corsOrigins =
    builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173" };

// AuthN/Z
builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(
        options =>
        {
            builder.Configuration.Bind("AzureAd", options);
            options.Events ??= new JwtBearerEvents();
        },
        options =>
        {
            builder.Configuration.Bind("AzureAd", options);
        }
    );

builder.Services.AddAuthorization();
builder.Services.AddCors();

// Services
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

// SQLite cache path is configurable via Cache:SqliteConnection or Cache:SqlitePath
var sqliteConn = builder.Configuration.GetValue<string>("Cache:SqliteConnection");
if (string.IsNullOrWhiteSpace(sqliteConn))
{
    var sqlitePath = builder.Configuration.GetValue<string>(
        "Cache:SqlitePath",
        "/tmp/rolereaper_cache.sqlite"
    );
    sqliteConn = $"Data Source={sqlitePath}";
}
builder.Services.AddDbContext<CacheDbContext>(opt => opt.UseSqlite(sqliteConn));
builder.Services.AddSingleton<IGraphServiceFactory, GraphServiceFactory>();
builder.Services.AddScoped<IRoleCache, RoleCache>();
builder.Services.AddScoped<IUserSearchService, UserSearchService>();
builder.Services.AddScoped<IReviewService, ReviewService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "RoleReaper API", Version = "v1" });
});

var app = builder.Build();

// Ensure database created (SQLite file in /tmp)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CacheDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors(policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
);

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Minimal API endpoints
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
// Cache status endpoint
app.MapGet(
        "/api/cache/status",
        async (IRoleCache cache) =>
        {
            await cache.InitializeAsync();
            var ts = await cache.GetLastUpdatedAsync();
            var count = cache.GetAll().Count;
            return Results.Ok(new { lastUpdatedUtc = ts, roleCount = count });
        }
    )
    .RequireAuthorization();

// Force refresh endpoint
app.MapPost(
        "/api/cache/refresh",
        async (IRoleCache cache) =>
        {
            await cache.RefreshAsync();
            var ts = await cache.GetLastUpdatedAsync();
            return Results.Ok(new { lastUpdatedUtc = ts });
        }
    )
    .RequireAuthorization();

app.MapGet(
        "/api/search",
        async (string q, bool includeGroups, IUserSearchService svc) =>
        {
            var results = await svc.SearchAsync(q, includeGroups);
            return Results.Ok(results);
        }
    )
    .RequireAuthorization();

app.MapPost(
        "/api/review",
        async (ReviewRequest request, IReviewService svc) =>
        {
            var result = await svc.ReviewAsync(request);
            return Results.Ok(result);
        }
    )
    .RequireAuthorization();

// Role details: fetch by id or by display name
app.MapGet(
        "/api/role",
        async (string? id, string? name, IRoleCache cache) =>
        {
            await cache.InitializeAsync();
            var roles = cache.GetAll();
            var actionPriv = cache.GetActionPrivilegeMap();

            Microsoft.Graph.Models.UnifiedRoleDefinition? match = null;
            if (!string.IsNullOrWhiteSpace(id))
            {
                roles.TryGetValue(id!, out match);
            }
            else if (!string.IsNullOrWhiteSpace(name))
            {
                match = roles.Values.FirstOrDefault(r =>
                    !string.IsNullOrWhiteSpace(r.DisplayName)
                    && string.Equals(r.DisplayName, name, StringComparison.OrdinalIgnoreCase)
                );
            }

            if (match == null)
            {
                return Results.NotFound(new { message = "Role not found" });
            }

            static string DescribeScope(string s)
            {
                if (string.IsNullOrWhiteSpace(s))
                    return "Unknown";
                if (s == "/")
                    return "Tenant-wide";
                string norm = s.Trim();
                if (norm.StartsWith("/administrativeUnits/", StringComparison.OrdinalIgnoreCase))
                    return "Administrative Unit scope";
                if (norm.StartsWith("/groups/", StringComparison.OrdinalIgnoreCase))
                    return "Group scope";
                if (norm.StartsWith("/users/", StringComparison.OrdinalIgnoreCase))
                    return "User scope";
                if (norm.StartsWith("/devices/", StringComparison.OrdinalIgnoreCase))
                    return "Device scope";
                if (norm.StartsWith("/applications/", StringComparison.OrdinalIgnoreCase))
                    return "Application scope";
                if (norm.StartsWith("/servicePrincipals/", StringComparison.OrdinalIgnoreCase))
                    return "Service principal scope";
                if (norm.StartsWith("/directoryObjects/", StringComparison.OrdinalIgnoreCase))
                    return "Directory object scope";
                return $"Resource scope ({s})";
            }

            var allowed = (match.RolePermissions ?? [])
                .SelectMany(rp => rp.AllowedResourceActions ?? [])
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(a => a, StringComparer.OrdinalIgnoreCase)
                .Select(a => new
                {
                    action = a,
                    privileged = actionPriv.TryGetValue(a, out var p) && p,
                })
                .ToList();

            var scopes = match.ResourceScopes ?? new List<string>();
            var scopeDetails = scopes
                .Select(s => new { value = s, description = DescribeScope(s) })
                .ToList();

            return Results.Ok(
                new
                {
                    id = match.Id,
                    name = match.DisplayName,
                    description = match.Description,
                    resourceScopes = scopes,
                    resourceScopesDetailed = scopeDetails,
                    permissions = allowed,
                }
            );
        }
    )
    .RequireAuthorization();

// Batch resolve role ids to display names
app.MapPost(
        "/api/roles/names",
        async (string[] ids, IRoleCache cache) =>
        {
            await cache.InitializeAsync();
            var roles = cache.GetAll();
            var unique = ids.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var result = unique
                .Select(id => new
                {
                    id,
                    name = roles.TryGetValue(id, out var def)
                        ? def.DisplayName ?? string.Empty
                        : string.Empty,
                })
                .ToList();
            return Results.Ok(result);
        }
    )
    .RequireAuthorization();

app.Run();
