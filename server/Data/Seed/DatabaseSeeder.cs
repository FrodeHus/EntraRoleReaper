using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using System.Text.Json;

namespace EntraRoleReaper.Api.Data.Seed;

public class DatabaseSeeder(
    ILogger<DatabaseSeeder> logger,
    IConfiguration configuration,
    IHostEnvironment env,
    IActivityRepository activityRepository
)
{
    private record ActivitySeedItem(string Activity, string AuditCategory, string Service);

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedActivitiesAsync(cancellationToken);
        await SeedMappings(cancellationToken);
    }

    private string ResolvePath(string fileName)
    {
        var baseSeedPath = configuration.GetValue<string>("Database:Seed:Path");
        var candidates = new List<string>();

        if (!string.IsNullOrWhiteSpace(baseSeedPath))
        {
            var resolved = Path.IsPathRooted(baseSeedPath)
                ? baseSeedPath
                : Path.GetFullPath(Path.Combine(env.ContentRootPath, baseSeedPath));
            candidates.Add(Path.Combine(resolved, fileName));
        }
        candidates.Add(Path.Combine(env.ContentRootPath, "seed", fileName));
        candidates.Add(Path.Combine(env.ContentRootPath, "..", "seed", fileName));
        candidates.Add(Path.Combine(AppContext.BaseDirectory, "seed", fileName));

        var path = candidates.FirstOrDefault(File.Exists);
        if (path is null)
        {
            logger.LogInformation(
                "Seed file not found. Skipping seeding. Searched: {Candidates}",
                candidates
            );
            return string.Empty;
        }
        return path;
    }

    private async Task SeedMappings(CancellationToken cancellationToken = default)
    {
        const string fileName = "rolereaper_mappings.json";
        var path = ResolvePath(fileName);
        // Implement mapping seeding if needed
        await Task.CompletedTask;
    }

    private async Task SeedActivitiesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            const string fileName = "entra_audit_activities.json";

            var path = ResolvePath(fileName);

            logger.LogInformation("Seeding activities from {Path}", path);
            await using var stream = File.OpenRead(path);
            var items = await JsonSerializer.DeserializeAsync<List<ActivitySeedItem>>(
                stream,
                cancellationToken: cancellationToken
            );
            items ??= new List<ActivitySeedItem>();

            var added = 0;
            foreach (var item in items)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var name = (item.Activity ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }
                try
                {
                    await activityRepository.AddAsync(new Activity { Name = name, AuditCategory = item.AuditCategory, Service = item.Service }, false);
                    added++;
                }
                catch (Exception ex)
                {
                    // Ignore uniqueness violations and continue; log others
                    logger.LogDebug(ex, "Failed to add activity '{Name}'", name);
                }
            }

            logger.LogInformation("Activity seeding complete. Processed {Count} entries.", added);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during database seeding");
        }
    }
}
