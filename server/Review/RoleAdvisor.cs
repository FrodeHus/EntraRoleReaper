using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Api.Review;

public class RoleAdvisor(ActivityPermissionAnalyzer permissionAnalyzer, IRoleService roleService)
{
    public async Task<List<RoleDefinition>> GetSuggestedRoles(Activity activity, IEnumerable<ReviewTargetResource> targets, string userId)
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

        var suggestedRoles = allSuggestedRoles.Select(grant => grant.Role).Distinct();
        return [.. suggestedRoles];
    }
}
