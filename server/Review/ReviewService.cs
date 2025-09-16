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
    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var userIds = await graphService.ExpandUsersOrGroupsAsync(request.UsersOrGroups);


        var results = new List<UserReview>();
        foreach (var uid in userIds)
        {
            // Audit operations + targets
            var auditActivities = await graphService.CollectAuditActivitiesAsync(request, uid);
            await SaveActivitiesAsync(auditActivities);

            var mappedActivities = auditActivities.Count > 0
                ? await activityService.GetActivitiesAsync(auditActivities.Select(a => a.ActivityName).ToList())
                : [];
            var activities = mappedActivities as Activity[] ?? mappedActivities.ToArray();
            var allSuggestedRoles = new List<RoleDefinitionDto>();
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

                var result = await roleEvaluationService.Evaluate(uid, activity, targets);

            }

        }

        return new ReviewResponse(results);
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