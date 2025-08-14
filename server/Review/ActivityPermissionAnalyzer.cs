using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Review;

public class ActivityPermissionAnalyzer(IGraphService graphService)
{

    internal IEnumerable<RoleDefinition> FindRelevantRoles(Activity activity, IEnumerable<RoleDefinition> roles)
    {
        var flattenedActions = activity.MappedResourceActions.Select(a => a.Action).ToList();
        return roles.Where(role => role.PermissionSets.Any(ps =>
            (ps.ResourceActions ?? []).Any(ra => flattenedActions.Any(fa => fa == ra.Action))));
    }

    internal async Task<IEnumerable<RoleDefinition>> EnsureConditionsAreMet(string userId, Activity activity, AuditTargetResource targetResource, IEnumerable<RoleDefinition> roles)
    {
        var relevantRoles = FindRelevantRoles(activity, roles);
        var rolesWithConditionsMet = new List<RoleDefinition>();
        var resourceActions = activity.MappedResourceActions.Select(a => a.Action);
        foreach (var role in relevantRoles)
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

    private async Task<bool> PermissionSetFulfillsRequiredActions(string userId, PermissionSet set, IEnumerable<string> resourceActions, AuditTargetResource target)
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
