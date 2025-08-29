using System.Runtime.ExceptionServices;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review;

public sealed class ActivityPermissionAnalyzer(IGraphService graphService)
{
    public async Task<IEnumerable<RoleGrant>> FindLeastPrivilegedRoles(string userId, Activity activity, ReviewTargetResource target, IEnumerable<RoleDefinitionDto> availableRoles)
    {
        var relevantRoles = FindRelevantRoles(activity, availableRoles);
        var conditionsMetRoles = await GetRolesMatchingCondition(userId, activity, target, relevantRoles);
        var filteredRoles = FilterOnCondition(conditionsMetRoles);
        var orderedRoles = OrderRolesByRelevance(filteredRoles, activity);
        return ArrangeByLeastPrivilegedResourceActions(orderedRoles);
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

    private IEnumerable<RoleGrant> OrderRolesByRelevance(IEnumerable<RoleGrant> roleDefinitions, Activity activity)
    {
        var ordered = new Dictionary<double, List<RoleGrant>>();
        var namespaceAndResources = activity.MappedResourceActions.Select(a => a.Action[..a.Action.IndexOf('/', a.Action.IndexOf('/', 1) + 1)])
            .Distinct();
        foreach (var roleGrant in roleDefinitions)
        {
            var permissionSet = roleGrant.Condition switch
            {
                "$SubjectIsOwner" => roleGrant.Role.PermissionSets.FirstOrDefault(ps =>
                    ps.Condition == "$SubjectIsOwner"),
                "$ResourceIsSelf" => roleGrant.Role.PermissionSets.FirstOrDefault(ps =>
                    ps.Condition == "$ResourceIsSelf"),
                "$Tenant" => roleGrant.Role.PermissionSets.FirstOrDefault(ps => ps.Condition == null),
                _ => null
            };
            if (permissionSet is null)
            {
                continue;
            }
            
            var actionCountByResource = GetActionCountByResource(permissionSet);
            var totalRelevantCounts = actionCountByResource.Where(ac =>
                    namespaceAndResources.Contains(ac.Key, StringComparer.OrdinalIgnoreCase))
                .Sum(ac => ac.Value);
            var relevanceScore = (double)totalRelevantCounts / (permissionSet.ResourceActions ?? []).Count;
            if (ordered.TryGetValue(relevanceScore, out List<RoleGrant>? value))
            {
                value.Add(roleGrant);
            }
            else
            {
                ordered.Add(relevanceScore, [roleGrant]);  
            }
        }
        if(ordered.Count == 0)
        {
            return [];
        }
        
        return ordered.OrderByDescending(kvp => kvp.Key).FirstOrDefault().Value;
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

    private Dictionary<string, int> GetActionCountByResource(PermissionSetDto set)
    {
        var resourceActions = new Dictionary<string, int>();
        foreach (var resource in from action in set.ResourceActions ?? []
                 select action.Action.Split('/')
                 into data
                 select data.Length > 1 ? $"{data[0]}/{data[1]}" : "default")
        {
            if (!resourceActions.TryAdd(resource, 1))
            {
                resourceActions[resource]++;
            }
        }

        return resourceActions;
    }
}

public class RoleGrant
{
    public required RoleDefinitionDto Role { get; set; }
    public string? Condition { get; set; }
}
