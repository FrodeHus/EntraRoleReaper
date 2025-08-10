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

app.Run();
