using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review;

public class RoleAdvisor(ActivityPermissionAnalyzer permissionAnalyzer, IRoleService roleService)
{
    public async Task<List<RoleDefinitionDto>> GetSuggestedRoles(Activity activity, IEnumerable<ReviewTargetResource> targets, string userId)
    {
        var allRoles = await roleService.GetAllRolesAsync();
        var allSuggestedRoles = new List<RoleGrant>();
        foreach (var target in targets)
        {
            var eligibleRoles = await permissionAnalyzer.FindLeastPrivilegedRoles(userId, activity, target, allRoles);
            allSuggestedRoles.AddRange(eligibleRoles);
        }

        if (allSuggestedRoles.Any(grant => grant.Condition == "$Tenant"))
        {
            //assume we have a tenant-wide role because the others didn't match all targets
            return [.. allSuggestedRoles
                .Where(grant => grant.Condition == "$Tenant")
                .Select(grant => grant.Role)
                .Distinct()];
        }

        var suggestedRoles = allSuggestedRoles.Select(grant => grant.Role).Distinct(new RoleComparer());
        return [.. suggestedRoles];
    }

    public List<RoleDefinitionDto> ConsolidateRoles(List<RoleDefinitionDto> allSuggestedRoles, List<ResourceAction> eligibleActions)
    {
        var finalRoles = new List<RoleDefinitionDto>();
        var distinctRoles = allSuggestedRoles.Distinct();
        var resourceGroups = eligibleActions.Select(a => a.Action.Split('/')[1]).Distinct();
        var rolesByResourceGroup = new Dictionary<string, List<RoleDefinitionDto>>();
        foreach (var resourceGroup in resourceGroups)
        {
            var rolesForGroup = FindRolesForResourceGroup(distinctRoles, eligibleActions, resourceGroup);
            if (rolesForGroup.Any())
            {
                rolesByResourceGroup[resourceGroup] = [.. rolesForGroup];
            }
        }
        
        foreach(var resourceGroup in rolesByResourceGroup.Keys)
        {
            var rolesForGroup = rolesByResourceGroup[resourceGroup];
            if (rolesForGroup.Count == 1)
            {
                finalRoles.Add(rolesForGroup[0]);
            }
            else
            {
                var leastPrivilegeRole = FindLeastPrivilegedRole(rolesForGroup, resourceGroup);
                finalRoles.Add(leastPrivilegeRole);
            }
        }
        var roleCandidates = new List<RoleDefinition>();
        return finalRoles;
    }

    private RoleDefinitionDto FindLeastPrivilegedRole(List<RoleDefinitionDto> rolesForGroup, string resourceGroup)
    {
        var rolesByPrivilege = rolesForGroup
            .GroupBy(role => role.PermissionSets.Count(ps => ps.ResourceActions != null && ps.ResourceActions.Any(ra => ra.IsPrivileged)))
            .OrderBy(g => g.Key);
        var leastPrivilegedGroup = rolesByPrivilege.First();
        var rolesByGroupActions = leastPrivilegedGroup
            .GroupBy(role => role.PermissionSets.SelectMany(ps => ps.ResourceActions ?? []).Count(ra => ra.Action.Split('/')[1] == resourceGroup))
            .OrderBy(g => g.Key);
        return rolesByGroupActions.First().FirstOrDefault() ?? leastPrivilegedGroup.First();
    }

    private IEnumerable<RoleDefinitionDto> FindRolesForResourceGroup(IEnumerable<RoleDefinitionDto> distinctRoles, List<ResourceAction> requiredActions, string resourceGroup)
    {
        return distinctRoles
            .Where(role => role.PermissionSets
                .Any(ps => ps.ResourceActions != null &&
                           ps.ResourceActions.Any(ra => ra.Action.Split('/')[1] == resourceGroup &&
                                                        requiredActions.Any(ra2 => ra2.Action == ra.Action))));

    }

}
