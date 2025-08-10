using EntraRoleAssignmentAuditor.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddSingleton<IGraphServiceFactory, GraphServiceFactory>();
builder.Services.AddSingleton<IRoleCache, RoleCache>();
builder.Services.AddScoped<IUserSearchService, UserSearchService>();
builder.Services.AddScoped<IReviewService, ReviewService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc(
        "v1",
        new OpenApiInfo { Title = "EntraRoleAssignmentAuditor API", Version = "v1" }
    );
});

var app = builder.Build();

app.UseCors(policy =>
    policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
);

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

// Minimal API endpoints
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

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

            return Results.Ok(
                new
                {
                    id = match.Id,
                    name = match.DisplayName,
                    description = match.Description,
                    permissions = allowed,
                }
            );
        }
    )
    .RequireAuthorization();

app.Run();
