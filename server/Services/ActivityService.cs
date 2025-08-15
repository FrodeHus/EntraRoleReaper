using System.Text.Json;
using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using JetBrains.Annotations;

namespace EntraRoleReaper.Api.Services;

public interface IActivityService
{
    Task<IEnumerable<ActivityExport>> ExportActivitiesAsync();
    Task<ImportResult> ImportAsync(IEnumerable<ActivityExport> importedData);
    Task AddPropertyMapToActivityAsync(string activityName, string propertyName, IEnumerable<Guid> resourceActionIds);
    Task DeletePropertyMapAsync(string activityName, string propertyName);
    Task SetExclusionAsync(string activityName, bool isExcluded);
    Task<IEnumerable<Activity>> GetExcludedActivitiesAsync();
    Task<IEnumerable<Activity>> GetActivitesAsync(IEnumerable<string> activityNames);
}

[UsedImplicitly]
public class ActivityService(IActivityRepository activityRepository, IResourceActionRepository resourceActionRepository)
    : IActivityService
{
    public async Task<IEnumerable<ActivityExport>> ExportActivitiesAsync()
    {
        var activities = await activityRepository.GetAllActivitiesAsync();
        var exportData = activities.Select(activity => new
            ActivityExport
            {
                Name = activity.Name,
                Properties = (activity.Properties ?? []).ToDictionary(p => p.Name,
                    p => (p.MappedResourceActions ?? []).Select(a => a.Action)),
                MappedResourceActions = activity.MappedResourceActions.Select(ra => ra.Action)
            });

        return exportData;
    }

    public async Task<ImportResult> ImportAsync(IEnumerable<ActivityExport> importedData)
    {
        var activityExports = importedData.ToList();
        if (activityExports.Count == 0)
        {
            return new ImportResult
            {
                SkippedActivities = 0,
                ImportedActivities = 0,
                UpdatedActivities = 0,
                ErrorMessage = "No activities to import."
            };
        }

        var importedCount = 0;

        await activityRepository.ClearAsync();
        foreach (var importedActivity in activityExports)
        {
            var allResourceActions = importedActivity.MappedResourceActions
                .Union(importedActivity.Properties.SelectMany(p => p.Value));
            var resourceActions = await resourceActionRepository.GetResourceActionsByNamesAsync(allResourceActions);
            // Create new activity
            var newActivity = new Activity
            {
                Name = importedActivity.Name,
                MappedResourceActions = resourceActions
                    .Where(r => importedActivity.MappedResourceActions.Contains(r.Action)).ToList()
            };

            foreach (var property in importedActivity.Properties)
            {
                var mappedActions = resourceActions.Where(r => property.Value.Contains(r.Action)).ToList();
                newActivity.Properties.Add(new ActivityProperty
                {
                    Name = property.Key,
                    MappedResourceActions = mappedActions
                });
            }

            await activityRepository.AddAsync(newActivity);
            importedCount++;
        }

        return new ImportResult
        {
            ImportedActivities = importedCount,
            ErrorMessage = null
        };
    }

    public async Task AddPropertyMapToActivityAsync(string activityName, string propertyName,
        IEnumerable<Guid> resourceActionIds)
    {
        await activityRepository.AddPropertyMapToActivityAsync(activityName, propertyName, resourceActionIds);
    }

    public async Task DeletePropertyMapAsync(string activityName, string propertyName)
    {   
        await activityRepository.DeletePropertyMapAsync(activityName, propertyName);
    }
    
    public async Task SetExclusionAsync(string activityName, bool isExcluded)
    {
        var existing = await activityRepository.GetByNameAsync(activityName);
        if (existing == null)
        {
            await activityRepository.AddAsync(new Activity
            {
                Name = activityName,
                IsExcluded = isExcluded
            });
            return;
        }

        await activityRepository.SetExclusionAsync(activityName, isExcluded);
    }

    public Task<IEnumerable<Activity>> GetExcludedActivitiesAsync()
    {
        return activityRepository.GetExcludedActivitiesAsync();
    }

    public Task<IEnumerable<Activity>> GetActivitesAsync(IEnumerable<string> activityNames)
    {
        return activityRepository.GetActivitiesByNamesAsync(activityNames);

    }
}

public class ActivityExport
{
    public string Name { get; set; } = string.Empty;
    public Dictionary<string, IEnumerable<string>> Properties { get; set; } = new();
    public IEnumerable<string> MappedResourceActions { get; set; } = [];
}

public class ImportResult
{
    public int ImportedActivities { get; set; }
    public int UpdatedActivities { get; set; }
    public int SkippedActivities { get; set; }
    public string? ErrorMessage { get; set; }
}