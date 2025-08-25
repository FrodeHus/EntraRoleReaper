using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Services.Dto;
using JetBrains.Annotations;

namespace EntraRoleReaper.Api.Services;

public interface IActivityService
{
    Task<IEnumerable<ActivityExport>> ExportActivitiesAsync();
    Task<ImportResult> ImportAsync(IEnumerable<ActivityExport> importedData);
    Task SetExclusionAsync(string activityName, bool isExcluded);
    Task<IEnumerable<Activity>> GetExcludedActivitiesAsync();
    Task<IEnumerable<Activity>> GetActivitiesAsync(List<string>? activityNames = null);
    Task<Activity?> AddAsync(Activity activity);
    Task<Activity?> GetActivityById(Guid activityId);
    Task<TargetResource?> GetTargetResource(Guid id);
    Task AddTargetResourceAsync(TargetResourceDto targetResource);
    Task<TargetResource?> GetTargetResourceByType(string resourceType);
    Task SaveChangesAsync();
}

[UsedImplicitly]
public class ActivityService(ReaperDbContext dbContext)
    : IActivityService
{
    private readonly ActivityRepository _activityRepository = new(dbContext);
    private readonly ResourceActionRepository _resourceActionRepository = new(dbContext);
    private readonly Repository<TargetResource> _targetResourceRepository = new(dbContext);
    private readonly Repository<TargetResourceProperty> _targetResourcePropertyRepository = new(dbContext);

    public async Task<IEnumerable<ActivityExport>> ExportActivitiesAsync()
    {
        var activities = await _activityRepository.Get(null, a => a.OrderBy(x => x.Name), "MappedResourceActions");
        var exportData = activities.Select(activity => new
            ActivityExport
        {
            Name = activity.Name,
            Category = activity.AuditCategory ?? string.Empty,
            Service = activity.Service ?? string.Empty,
            TargetResources = activity.TargetResources.Select(TargetResourceDto.FromTargetResource).ToList(),
            MappedResourceActions = activity.MappedResourceActions.Select(ra => ra.Action)
        });

        return exportData;
    }

    public async Task<TargetResource?> GetTargetResource(Guid id)
    {
        var targetResource = await _targetResourceRepository.GetById(id);
        return targetResource;
    }
    
    public async Task<TargetResource?> GetTargetResourceByType(string resourceType)
    {
        var targetResources = await _targetResourceRepository.Get(r => r.ResourceType == resourceType, null, "Properties");
        return targetResources.FirstOrDefault();
    }
    
    public async Task AddTargetResourceAsync(TargetResourceDto targetResource)
    {
        var newTargetResource = new TargetResource
        {
            ResourceType = targetResource.ResourceType,
            Properties = targetResource.Properties.Select(p => new TargetResourceProperty
            {
                PropertyName = p.PropertyName,
                Description = p.Description
            }).ToList()
        };
        _targetResourceRepository.Add(newTargetResource);
        await SaveChangesAsync();
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

        await _activityRepository.ClearAsync();
        foreach (var importedActivity in activityExports)
        {
            var allResourceActions = importedActivity.MappedResourceActions;
            var resourceActions = await _resourceActionRepository.GetResourceActionsByNamesAsync(allResourceActions);
            // Create new activity
            var newActivity = new Activity
            {
                Name = importedActivity.Name,
                MappedResourceActions = resourceActions
                    .Where(r => importedActivity.MappedResourceActions.Contains(r.Action)).ToList()
            };

            await _activityRepository.AddAsync(newActivity);
            importedCount++;
        }

        return new ImportResult
        {
            ImportedActivities = importedCount,
            ErrorMessage = null
        };
    }

    public async Task SetExclusionAsync(string activityName, bool isExcluded)
    {
        var existing = await _activityRepository.GetByNameAsync(activityName);
        if (existing == null)
        {
            await _activityRepository.AddAsync(new Activity
            {
                Name = activityName,
                IsExcluded = isExcluded
            });
            return;
        }
        existing.IsExcluded = isExcluded;
        _activityRepository.Update(existing);
        await SaveChangesAsync();
    }

    public Task<IEnumerable<Activity>> GetExcludedActivitiesAsync()
    {
        return _activityRepository.GetExcludedActivitiesAsync();
    }

    public Task<IEnumerable<Activity>> GetActivitiesAsync(List<string>? activityNames = null)
    {
        if (activityNames == null || activityNames.Count == 0)
        {
            return _activityRepository.GetAllActivitiesAsync();
        }
        return _activityRepository.GetActivitiesByNamesAsync(activityNames);
    }

    public async Task<Activity?> AddAsync(Activity activity)
    {
        var existing = await _activityRepository.GetByNameAsync(activity.Name);
        if (existing == null)
        {
            existing = await _activityRepository.AddAsync(activity);
            await SaveChangesAsync();
        }
        foreach(var targetResource in activity.TargetResources)
        {
            var existingTarget = await GetTargetResourceByType(targetResource.ResourceType);
            if (existingTarget == null)
            {
                _targetResourceRepository.Add(targetResource);
            }
            if (existing.TargetResources.Any(tr => tr.ResourceType == targetResource.ResourceType)) continue;
            existing.TargetResources.Add(existingTarget ?? targetResource);
        }
        await SaveChangesAsync();
        return existing;
    }

    public Task<Activity?> GetActivityById(Guid activityId)
    {
        if (activityId == Guid.Empty)
        {
            return Task.FromResult<Activity?>(null);
        }
        return _activityRepository.GetByIdAsync(activityId);
    }
    
    public async Task SaveChangesAsync()
    {
        await dbContext.SaveChangesAsync();
    }
}

public class ActivityExport
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public IEnumerable<TargetResourceDto> TargetResources { get; set; } = [];
    public IEnumerable<string> MappedResourceActions { get; set; } = [];
}

public class ImportResult
{
    public int ImportedActivities { get; set; }
    public int UpdatedActivities { get; set; }
    public int SkippedActivities { get; set; }
    public string? ErrorMessage { get; set; }
}