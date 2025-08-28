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
    Task<Activity?> AddAsync(ActivityDto activity);
    Task<Activity?> GetActivityById(Guid activityId);
    Task<TargetResource?> GetTargetResource(Guid id);
    Task AddTargetResourceAsync(TargetResourceDto targetResource);
    Task<TargetResource?> GetTargetResourceByType(string resourceType);
    Task UpdateTargetResourceAsync(TargetResource targetResource);
    Task<TargetResourceProperty?> GetTargetResourcePropertyById(Guid id);
    Task<ResourceAction?> GetResourceActionById(Guid id);
    Task MapActivityToTargetResourcePropertyAsync(Guid targetResourceProperty, Guid resourceActionId);
    Task MapResourceActionsToActivity(Guid[] resourceActionIds, Guid activityId);
}

[UsedImplicitly]
public class ActivityService(ReaperDbContext dbContext, ILogger<ActivityService> logger)
    : UnitOfWorkService(dbContext, logger), IActivityService
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

    public async Task<Activity?> AddAsync(ActivityDto activity)
    {
        var existing = await _activityRepository.GetByNameAsync(activity.ActivityName);
        var targetResources = new List<TargetResource>();

        foreach (var targetResourceDto in activity.TargetResources ?? [])
        {
            var existingTarget = await GetTargetResourceByType(targetResourceDto.ResourceType) ?? targetResources.Find(tr => tr.ResourceType == targetResourceDto.ResourceType);
            if (existingTarget == null)
            {
                existingTarget = new TargetResource
                {
                    ResourceType = targetResourceDto.ResourceType,
                    Properties = targetResourceDto.Properties.Select(p => new TargetResourceProperty
                    {
                        PropertyName = p.PropertyName,
                        Description = p.Description
                    }).ToList()
                };
                _targetResourceRepository.Add(existingTarget);
                targetResources.Add(existingTarget);
            }
            else
            {
                foreach (var prop in targetResourceDto.Properties)
                {
                    if (existingTarget.Properties.All(p => p.PropertyName != prop.PropertyName))
                    {
                        var newProp = new TargetResourceProperty
                        {
                            PropertyName = prop.PropertyName,
                            Description = prop.Description,
                            TargetResourceId = existingTarget.Id
                        };
                        _targetResourcePropertyRepository.Add(newProp);
                    }
                }
                _targetResourceRepository.Update(existingTarget);
            }

            existing?.TargetResources.Add(existingTarget);
        }

        if (existing is null)
        {
            existing = new Activity
            {
                Name = activity.ActivityName,
                AuditCategory = activity.Category,
                Service = activity.Service,
                IsExcluded = false,
                TargetResources = targetResources
            };
            _activityRepository.Add(existing);
        }
        else
        {
            _activityRepository.Update(existing);
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

    public async Task UpdateTargetResourceAsync(TargetResource targetResource)
    {
        _targetResourceRepository.Update(targetResource);
        await SaveChangesAsync();
    }

    public Task<TargetResourceProperty?> GetTargetResourcePropertyById(Guid id)
    {
        return _targetResourcePropertyRepository.GetById(id);
    }

    public Task<ResourceAction?> GetResourceActionById(Guid id)
    {
        return _resourceActionRepository.GetById(id);
    }

    public async Task MapActivityToTargetResourcePropertyAsync(Guid targetResourceProperty, Guid resourceActionId)
    {
        var targetResourceProp = await _targetResourcePropertyRepository.GetById(targetResourceProperty);
        if (targetResourceProp == null)
            return;

        var resourceAction = await _resourceActionRepository.GetById(resourceActionId);
        if (resourceAction == null)
            return;
        if(targetResourceProp.MappedResourceActions.Any(ra => ra.Id == resourceAction.Id))
            return;
        targetResourceProp.MappedResourceActions.Add(resourceAction);
        _targetResourcePropertyRepository.Update(targetResourceProp);
        await SaveChangesAsync();
    }

    public async Task MapResourceActionsToActivity(Guid[] resourceActionIds, Guid activityId)
    {
        var activity = await GetActivityById(activityId);
        if(activity == null)
            return;

        foreach (var resourceActionId in resourceActionIds)
        {
            var resourceAction = _resourceActionRepository.GetById(resourceActionId).Result;
            if(resourceAction == null)
                continue;
            
            if(activity.MappedResourceActions.Any(ra => ra.Id == resourceAction.Id))
                continue;
            activity.MappedResourceActions.Add(resourceAction);
        }
        _activityRepository.Update(activity);
        await SaveChangesAsync();
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