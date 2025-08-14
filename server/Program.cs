using System.Text.Json;
using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Endpoints;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;

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
        options => { builder.Configuration.Bind("AzureAd", options); }
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
        "Database:SqlitePath",
        "/tmp/rolereaper.db"
    );
    sqliteConn = $"Data Source={sqlitePath}";
}

var enableDiag = Environment.GetEnvironmentVariable("ROLE_REAPER_DIAG") == "1";
builder.Services.AddDbContext<ReaperDbContext>(opt =>
{
    opt.UseLazyLoadingProxies();
    opt.UseSqlite(sqliteConn);
    if (enableDiag)
    {
        opt.EnableSensitiveDataLogging();
        opt.EnableDetailedErrors();
    }
});
builder.Services.AddSingleton<IGraphServiceFactory, GraphServiceFactory>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IResourceActionRepository, ResourceActionRepository>();
builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IActivityService, ActivityService>();
builder.Services.AddScoped<IUserSearchService, UserSearchService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<GraphService>();
builder.Services.AddScoped<ICacheService, CacheService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "RoleReaper API", Version = "v1" });
});

var app = builder.Build();

// Global diagnostics hooks
if (enableDiag)
{
    AppDomain.CurrentDomain.UnhandledException += (s, e) =>
    {
        try
        {
            Console.WriteLine($"[FATAL] UnhandledException: {e.ExceptionObject}");
        }
        catch
        {
        }
    };
    TaskScheduler.UnobservedTaskException += (s, e) =>
    {
        try
        {
            Console.WriteLine($"[WARN] UnobservedTaskException: {e.Exception}");
        }
        catch
        {
        }
    };
}

// Database (cache) initialization with optional recreation toggle
using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<ReaperDbContext>();
var reset = Environment.GetEnvironmentVariable("ROLE_REAPER_RESET_DB") == "1";
if (reset)
{
    try
    {
        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
        Console.WriteLine("[Startup] Cache database recreated (ROLE_REAPER_RESET_DB=1).");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Failed recreating database: {ex.Message}");
    }
}
else
{
    try
    {
        await db.Database.EnsureCreatedAsync();
        Console.WriteLine("[Startup] Cache database ensured (no reset).");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Failed ensuring database: {ex.Message}");
    }
}


app.UseCors(policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
);

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Simple exception logging middleware (before endpoints)
app.Use(async (ctx, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                $"[ERR] Request {ctx.Request.Method} {ctx.Request.Path} failed: {ex}"
            );
            throw;
        }
    }
);

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