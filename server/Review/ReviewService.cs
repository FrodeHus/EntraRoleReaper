using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Review;

public class ReviewService(
    IGraphService graphService,
    IActivityService activityService,
    RoleEvaluationService roleEvaluationService
) : IReviewService
{
    public async Task<List<UserReviewResult>> ReviewAsync(List<string> usersOrGroups, DateTimeOffset from, DateTimeOffset to, Guid tenantId)
    {
        var userIds = await graphService.ExpandUsersOrGroupsAsync(usersOrGroups);


        var results = new List<UserReviewResult>();
        foreach (var uid in userIds)
        {
            // Audit operations + targets
            var auditActivities = await graphService.CollectAuditActivitiesAsync(uid, from, to);
            await SaveActivitiesAsync(auditActivities);

            var mappedActivities = auditActivities.Count > 0
                ? await activityService.GetActivitiesAsync(auditActivities.ConvertAll(a => a.ActivityName))
                : [];
            var activities = mappedActivities as Activity[] ?? [.. mappedActivities];
            UserReviewResult? userResults = null;
            foreach (var activity in activities)
            {
                if (activity.IsExcluded)
                {
                    auditActivities.RemoveAll(a =>
                        a.ActivityName.Equals(activity.Name, StringComparison.InvariantCultureIgnoreCase));
                    continue;
                }

                var auditActivity = auditActivities.FirstOrDefault(a =>
                    a.ActivityName.Equals(activity.Name, StringComparison.InvariantCultureIgnoreCase));
                var targets = auditActivity?.TargetResources.ConvertAll(t => new ReviewTargetResource
                {
                    Id = t.Id,
                    DisplayName = t.DisplayName,
                    Type = t.Type,
                    ModifiedProperties = t.ModifiedProperties
                }) ?? [];
                var activityDto = ActivityDto.FromActivity(activity, true);
                var (user, result) = await roleEvaluationService.Evaluate(uid, tenantId, activityDto, targets);
                var activityReviewResult = new ActivityReviewResult(activityDto, result);
                if(userResults is null)
                {
                    userResults = new UserReviewResult(user, [activityReviewResult]);
                }
                else
                {
                    userResults.ActivityResults.Add(activityReviewResult);
                }
            }
            if(userResults is not null) results.Add(userResults);
        }
        return results;
    }

    private async Task SaveActivitiesAsync(IEnumerable<AuditActivity> activities)
    {
        foreach (var auditActivity in activities)
        {
            await activityService.AddAsync(new ActivityDto
            (
                Guid.NewGuid(),
                auditActivity.ActivityName,
                "Imported",
                "Imported",
                auditActivity.TargetResources.Select(x => new TargetResourceDto
                (
                    Guid.NewGuid(),
                    x.Type,
                    (x.ModifiedProperties ?? []).Where(mp => !string.IsNullOrEmpty(mp.DisplayName)).Select(mp =>
                        new TargetResourcePropertyDto(
                            Guid.NewGuid(),
                            mp.DisplayName!,
                            false,
                            null, null)).ToList()
                )).ToList()
            ));
        }
    }
}