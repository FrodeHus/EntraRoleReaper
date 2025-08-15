using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services;

public class ReviewService(
    IGraphService graphService,
    RoleAdvisor roleAdvisor,
    IRoleService roleService,
    IActivityService activityService,
    ICacheService cache
) : IReviewService
{

    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var userIds = await graphService.ExpandUsersOrGroupsAsync(request.UsersOrGroups);

        // var results = new List<UserReview>();
        // await roleService.InitializeAsync();
        // var roles = cacheService.GetAll();
        // var actionPrivilege = roleCache.GetActionPrivilegeMap();
        // var roleStats = roleCache.GetRolePrivilegeStats();
        //
        var results = new List<UserReview>();
        foreach (var uid in userIds)
        {
            // Fetch core user + role context
            var userCtx = await graphService.GetUserAndRolesAsync(uid);


            // Audit operations + targets
            var auditActivities = await graphService.CollectAuditActivitiesAsync(request, uid);
            var mappedActivities = await activityService.GetActivitesAsync(auditActivities.Select(a => a.ActivityName));
            var allSuggestedRoles = new List<RoleDefinition>();
            foreach (var activity in mappedActivities)
            {
                if (activity.IsExcluded)
                {
                    // Skip excluded activities
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
            var userCurrentActiveRoles = userCtx.ActiveRoleIds.Select(async id => await cache.GetRoleByIdAsync(id));
            var userCurrentEligiblePimRoles = userCtx.EligibleRoleIds.Select(async id => await cache.GetRoleByIdAsync(id));
            var roles = await Task.WhenAll(userCurrentActiveRoles);
            var pimRoles = await Task.WhenAll(userCurrentEligiblePimRoles);
            user = user with
            {
                CurrentActiveRoles = [.. roles.Select(r => new SimpleRole(r.Id.ToString(), r.DisplayName))],
                CurrentEligiblePimRoles = [.. pimRoles.Select(r => new SimpleRole(r.Id.ToString(), r.DisplayName))]
            };
            consolidatedRoles = consolidatedRoles.Where(r => !roles.Any(role => role?.Id == r.Id) || pimRoles.Any(pimRole => pimRole?.Id == r.Id)).ToList();
            var removedRoles = roles.Where(r => !consolidatedRoles.Any(cr => cr.Id == r.Id)).ToList();
            removedRoles = pimRoles.Where(r => !consolidatedRoles.Any(cr => cr.Id == r.Id)).ToList();

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
}
