using EntraRoleReaper.Api;
using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using Microsoft.OpenApi.Models;
using EntraRoleReaper.Api.Data.Seed;

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
var sqliteConn = builder.Configuration.GetValue<string>("Database:SqliteConnection");
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
builder.Services.AddScoped<IGraphService, GraphService>();
builder.Services.AddScoped<ICacheService, CacheService>();
builder.Services.AddScoped<ActivityPermissionAnalyzer>();
builder.Services.AddScoped<RoleAdvisor>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "RoleReaper API", Version = "v1" });
});
builder.Services.AddScoped<DatabaseSeeder>();

var app = builder.Build();

await app.ConfigureApplication(corsOrigins);

// Run seeders after database is ready
using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
    await seeder.SeedAsync();
}

app.Run();