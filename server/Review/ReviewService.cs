using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Review;

public class ReviewService(
    IGraphService graphService,
    RoleAdvisor roleAdvisor,
    IActivityService activityService,
    ICacheService cache
) : IReviewService
{

    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var userIds = await graphService.ExpandUsersOrGroupsAsync(request.UsersOrGroups);


        var results = new List<UserReview>();
        foreach (var uid in userIds)
        {
            // Fetch core user + role context
            var userCtx = await graphService.GetUserAndRolesAsync(uid);


            // Audit operations + targets
            var auditActivities = await graphService.CollectAuditActivitiesAsync(request, uid);
            await SaveActivitiesAsync(auditActivities);

            var mappedActivities = await activityService.GetActivitesAsync(auditActivities.Select(a => a.ActivityName).ToList());
            var allSuggestedRoles = new List<RoleDefinitionDto>();
            foreach (var activity in mappedActivities)
            {
                if (activity.IsExcluded)
                {
                    auditActivities.RemoveAll(a => a.ActivityName.Equals(activity.Name, StringComparison.InvariantCultureIgnoreCase));
                    continue;
                }

                var auditActivity = auditActivities.FirstOrDefault(a => a.ActivityName.Equals(activity.Name, StringComparison.InvariantCultureIgnoreCase));
                var targets = auditActivity?.TargetResources.ConvertAll(t => new ReviewTargetResource
                {
                    Id = t.Id,
                    DisplayName = t.DisplayName,
                    Type = t.Type,
                    ModifiedProperties = t.ModifiedProperties
                }) ?? [];

                var suggestedRoles = await roleAdvisor.GetSuggestedRoles(
                    activity,
                    targets,
                    uid
                );
                allSuggestedRoles.AddRange(suggestedRoles);
            }

            var eligibleActions = mappedActivities.SelectMany(a => a.MappedResourceActions).ToList();

            var consolidatedRoles = roleAdvisor.ConsolidateRoles(allSuggestedRoles, eligibleActions);

            var reviewedActivities = auditActivities.ConvertAll(a => new OperationReview
            (
                a.ActivityName,
                a.TargetResources.ConvertAll(t => new OperationTarget(
                    t.Id,
                    t.DisplayName,
                    [.. (t.ModifiedProperties ?? []).Select(mp => new OperationModifiedProperty(
                        mp.DisplayName,
                        mp.OldValue,
                        mp.NewValue
                    ))]
                )),
                []
            ));

            var user = new SimpleUser(uid, userCtx.DisplayName ?? uid, null, null);
            var userCurrentActiveRoles = userCtx.ActiveRoleIds.Select(async id => await cache.GetRoleByIdAsync(Guid.Parse(id)));
            var userCurrentEligiblePimRoles = userCtx.EligibleRoleIds.Select(async id => await cache.GetRoleByIdAsync(Guid.Parse(id)));
            var roles = await Task.WhenAll(userCurrentActiveRoles);
            var pimRoles = await Task.WhenAll(userCurrentEligiblePimRoles);
            user = user with
            {
                CurrentActiveRoles = [.. roles.Select(r => new SimpleRole(r.Id.ToString(), r.DisplayName))],
                CurrentEligiblePimRoles = [.. pimRoles.Select(r => new SimpleRole(r.Id.ToString(), r.DisplayName))]
            };
            consolidatedRoles = [.. consolidatedRoles.Distinct(new RoleComparer()).Where(r => roles.All(role => role?.Id != r.Id) || pimRoles.Any(pimRole => pimRole?.Id == r.Id))];
            var removedRoles = roles.Where(r => r is not null && !consolidatedRoles.Any(cr => cr.Id == r.Id)).ToList();
            removedRoles = pimRoles.Where(r => r is not null && !consolidatedRoles.Any(cr => cr.Id == r.Id)).ToList();

            var review = new UserReview(user, reviewedActivities, consolidatedRoles.ConvertAll(r => new SimpleRole
            (
                r.Id.ToString(),
                r.DisplayName
            )), removedRoles.Select(r => new SimpleRole
            (
                r.Id.ToString(),
                r.DisplayName
            )).ToList());
            results.Add(review);
        }
        return new ReviewResponse(results);
    }

    private async Task SaveActivitiesAsync(IEnumerable<AuditActivity> activities)
    {
        foreach (var auditActivity in activities)
        {
            await activityService.AddAsync(new Activity
            {
                Name = auditActivity.ActivityName,
            });
        }
    }
}
