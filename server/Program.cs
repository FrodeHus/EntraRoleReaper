using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;
using RoleReaper.Data;
using RoleReaper.Endpoints;
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
builder.Services.AddDbContext<CacheDbContext>(opt =>
{
    opt.UseLazyLoadingProxies();
    opt.UseSqlite(sqliteConn);
});
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
    try
    {
        // Verify required table 'operation_map' exists; if not, recreate DB (cache reset)
        bool hasOperationMap = false;
        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText =
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='operation_map' LIMIT 1";
            var result = await cmd.ExecuteScalarAsync();
            hasOperationMap = result != null;
        }
        if (!hasOperationMap)
        {
            Console.WriteLine(
                "[Startup] Detected legacy cache schema (missing operation_map); recreating cache DB."
            );
            await conn.CloseAsync();
            var cs = conn.ConnectionString;
            var pathPart = cs.Split('=', 2).LastOrDefault();
            if (!string.IsNullOrWhiteSpace(pathPart) && File.Exists(pathPart))
            {
                try
                {
                    File.Delete(pathPart);
                    Console.WriteLine($"[Startup] Deleted old cache file {pathPart}.");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Startup] Failed deleting old cache file: {ex.Message}");
                }
            }
            // Recreate
            db.Database.EnsureCreated();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Schema verification failed: {ex.Message}");
    }
    // Seed OperationMap from permissions-map.json if empty (robust against missing table)
    try
    {
        bool needSeed = false;
        try
        {
            needSeed = !db.OperationMaps.Any();
        }
        catch (Exception ex)
            when (ex.Message.Contains("no such table", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine(
                "[Startup] operation_map table missing during seed check; recreating cache DB."
            );
            try
            {
                var conn = db.Database.GetDbConnection();
                await conn.CloseAsync();
                var cs = conn.ConnectionString;
                var pathPart = cs.Split('=', 2).LastOrDefault();
                if (!string.IsNullOrWhiteSpace(pathPart) && File.Exists(pathPart))
                {
                    File.Delete(pathPart);
                    Console.WriteLine($"[Startup] Deleted old cache file {pathPart}.");
                }
            }
            catch (Exception delEx)
            {
                Console.WriteLine($"[Startup] Failed deleting cache DB: {delEx.Message}");
            }
            db.Database.EnsureCreated();
            needSeed = true; // new DB
        }

        if (needSeed)
        {
            var cfgPath = Path.Combine(
                AppContext.BaseDirectory,
                "Configuration",
                "permissions-map.json"
            );
            if (File.Exists(cfgPath))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(cfgPath);
                    var dict =
                        JsonSerializer.Deserialize<Dictionary<string, string[]>>(json) ?? new();
                    var actionLookup = db.ResourceActions.ToDictionary(
                        a => a.Action,
                        a => a,
                        StringComparer.OrdinalIgnoreCase
                    );
                    foreach (var kvp in dict)
                    {
                        var op = new OperationMapEntity { OperationName = kvp.Key };
                        foreach (var action in kvp.Value.Distinct(StringComparer.OrdinalIgnoreCase))
                        {
                            if (!actionLookup.TryGetValue(action, out var ra))
                            {
                                ra = new ResourceActionEntity
                                {
                                    Action = action,
                                    IsPrivileged = false,
                                };
                                db.ResourceActions.Add(ra);
                                actionLookup[action] = ra;
                            }
                            op.ResourceActions.Add(ra);
                        }
                        db.OperationMaps.Add(op);
                    }
                    await db.SaveChangesAsync();
                    Console.WriteLine(
                        $"[Startup] Seeded {dict.Count} operations into operation_map."
                    );
                }
                catch (Exception seedEx)
                {
                    Console.WriteLine($"Failed seeding operation map: {seedEx.Message}");
                }
            }
            else
            {
                Console.WriteLine(
                    "[Startup] permissions-map.json not found; skipping operation map seed."
                );
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Unexpected error during operation map seeding: {ex.Message}");
    }
}

app.UseCors(policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
);

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Minimal API endpoints composed via extension methods (explicit static call for Health to avoid resolution issues)
app.MapHealth()
    .MapCache()
    .MapRolesSummary()
    .MapOperationMap()
    .MapActions()
    .MapSearch()
    .MapReview()
    .MapRolesLookup();

app.Run();
