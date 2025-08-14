using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Api.Review;

public sealed class ActivityPermissionAnalyzer(IGraphService graphService)
{
    public async Task<IEnumerable<RoleDefinition>> FindLeastPrivilegedRoles(string userId, Activity activity, ReviewTargetResource target, IEnumerable<RoleDefinition> availableRoles)
    {
        var relevantRoles = FindRelevantRoles(activity, availableRoles);
        var conditionsMetRoles = await GetRoleDefinitionsAsync(userId, activity, target, relevantRoles);
        var filteredRoles = FilterOnCondition(conditionsMetRoles);
        return ArrangeByLeastPrivilegedResourceActions(filteredRoles);
    }

    private static IEnumerable<RoleDefinition> ArrangeByLeastPrivilegedResourceActions(IEnumerable<RoleDefinition> roles)
    {
        return roles.OrderBy(role => role.PermissionSets
            .SelectMany(ps => ps.ResourceActions ?? [])
            .Count(ra => ra.IsPrivileged));
    }

    private static IEnumerable<RoleDefinition> FilterOnCondition(IEnumerable<RoleDefinition> conditionsMetRoles)
    {
        var preferredRoles = conditionsMetRoles.Where(role => role.PermissionSets.Any(ps => ps.Condition == "$ResourceIsSelf" || ps.Condition == "$SubjectIsOwner")).ToList();

        if (!preferredRoles.Any())
        {
            preferredRoles = conditionsMetRoles.Where(role => role.PermissionSets.Any(ps => ps.Condition == null)).ToList();
        }
        return preferredRoles;
    }

    private static IEnumerable<RoleDefinition> FindRelevantRoles(Activity activity, IEnumerable<RoleDefinition> roles)
    {
        var flattenedActions = activity.MappedResourceActions.Select(a => a.Action).ToList();
        return roles.Where(role => role.PermissionSets.Any(ps =>
            (ps.ResourceActions ?? []).Any(ra => flattenedActions.Any(fa => fa == ra.Action))));
    }

    private async Task<IEnumerable<RoleDefinition>> GetRoleDefinitionsAsync(string userId, Activity activity, ReviewTargetResource targetResource, IEnumerable<RoleDefinition> roles)
    {
        var rolesWithConditionsMet = new List<RoleDefinition>();
        var resourceActions = activity.MappedResourceActions.Select(a => a.Action);
        foreach (var role in roles)
        {
            foreach (var permissionSet in role.PermissionSets)
            {
                if (await PermissionSetFulfillsRequiredActions(userId, permissionSet, resourceActions, targetResource))
                {
                    rolesWithConditionsMet.Add(role);
                    break;
                }
            }
        }
        return rolesWithConditionsMet;
    }

    private async Task<bool> PermissionSetFulfillsRequiredActions(string userId, PermissionSet set, IEnumerable<string> resourceActions, ReviewTargetResource target)
    {
        var hasRequiredActions = set.ResourceActions?.Any(ra => resourceActions.Any(raAction => raAction.Equals(ra.Action, StringComparison.OrdinalIgnoreCase))) ?? false;
        return set.Condition switch
        {
            "$SubjectIsOwner" => hasRequiredActions && await graphService.IsOwnerAsync(userId, target),
            "$ResourceIsSelf" => hasRequiredActions && userId.Equals(target.Id, StringComparison.InvariantCultureIgnoreCase),
            _ => hasRequiredActions
        };
    }
}
