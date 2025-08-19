using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review;

public sealed class ActivityPermissionAnalyzer(IGraphService graphService)
{
    public async Task<IEnumerable<RoleGrant>> FindLeastPrivilegedRoles(string userId, Activity activity, ReviewTargetResource target, IEnumerable<RoleDefinitionDto> availableRoles)
    {
        var relevantRoles = FindRelevantRoles(activity, availableRoles);
        var conditionsMetRoles = await GetRolesMatchingCondition(userId, activity, target, relevantRoles);
        var filteredRoles = FilterOnCondition(conditionsMetRoles);
        return ArrangeByLeastPrivilegedResourceActions(filteredRoles);
    }

    private static IEnumerable<RoleGrant> ArrangeByLeastPrivilegedResourceActions(IEnumerable<RoleGrant> roleGrants)
    {
        return roleGrants.OrderBy(grant => grant.Role.PermissionSets
            .SelectMany(ps => ps.ResourceActions ?? [])
            .Count(ra => ra.IsPrivileged));
    }

    private static IEnumerable<RoleGrant> FilterOnCondition(IEnumerable<RoleGrant> conditionsMetRoles)
    {
        var preferredRoles = conditionsMetRoles.Where(grant => grant.Role.PermissionSets.Any(ps => ps.Condition == "$ResourceIsSelf" || ps.Condition == "$SubjectIsOwner")).ToList();

        if (!preferredRoles.Any())
        {
            preferredRoles = conditionsMetRoles.Where(grant => grant.Role.PermissionSets.Any(ps => ps.Condition == null)).ToList();
        }
        return preferredRoles;
    }

    private static IEnumerable<RoleDefinitionDto> FindRelevantRoles(Activity activity, IEnumerable<RoleDefinitionDto> roles)
    {
        var flattenedActions = activity.MappedResourceActions.Select(a => a.Action).ToList();
        return roles.Where(role => role.PermissionSets.Any(ps =>
            (ps.ResourceActions ?? []).Any(ra => flattenedActions.Any(fa => fa == ra.Action))));
    }

    private async Task<IEnumerable<RoleGrant>> GetRolesMatchingCondition(string userId, Activity activity, ReviewTargetResource targetResource, IEnumerable<RoleDefinitionDto> roles)
    {
        var rolesWithConditionsMet = new List<RoleGrant>();
        var resourceActions = activity.MappedResourceActions.Select(a => a.Action);
        foreach (var role in roles)
        {
            foreach (var permissionSet in role.PermissionSets)
            {
                var (granted, condition) = await PermissionSetFulfillsRequiredActions(userId, permissionSet, resourceActions, targetResource);
                if (granted)
                {
                    rolesWithConditionsMet.Add(new RoleGrant { Role = role, Condition = condition });
                    break;
                }
            }
        }
        return rolesWithConditionsMet;
    }

    private async Task<(bool granted, string condition)> PermissionSetFulfillsRequiredActions(string userId, PermissionSetDto set, IEnumerable<string> resourceActions, ReviewTargetResource target)
    {
        var hasRequiredActions = set.ResourceActions?.Any(ra => resourceActions.Any(raAction => raAction.Equals(ra.Action, StringComparison.OrdinalIgnoreCase))) ?? false;
        return set.Condition switch
        {
            "$SubjectIsOwner" => (hasRequiredActions && await graphService.IsOwnerAsync(userId, target), "$SubjectIsOwner"),
            "$ResourceIsSelf" => (hasRequiredActions && userId.Equals(target.Id, StringComparison.InvariantCultureIgnoreCase), "$ResourceIsSelf"),
            _ => (hasRequiredActions, "$Tenant")
        };
    }
}

public class RoleGrant
{
    public required RoleDefinitionDto Role { get; set; }
    public string? Condition { get; set; }
}
