using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Middlewares;
using Microsoft.EntityFrameworkCore;

namespace EntraRoleReaper.Api;

public static class ConfigureApp
{
    public static async Task ConfigureApplication(this WebApplication app, string[] corsOrigins)
    {
        app.UseCors(policy =>
            policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
        );

        app.UseSwagger();
        app.UseSwaggerUI();

        app.UseAuthentication();
        app.UseAuthorization();

        app.UseMiddleware<TenantMiddleware>();

        app.MapEndpoints();
        await app.EnsureDatabaseCreated();
    }

    
    private static async Task EnsureDatabaseCreated(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ReaperDbContext>();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () => { await db.Database.MigrateAsync(); });
    }
}