using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Api.Review;

public class RoleAdvisor(ActivityPermissionAnalyzer permissionAnalyzer, IRoleService roleService)
{
    public async Task<List<RoleDefinition>> GetSuggestedRoles(Activity activity, IEnumerable<ReviewTargetResource> targets, string userId)
    {
        var allRoles = await roleService.GetAllRolesAsync();
        var suggestedRoles = new List<RoleDefinition>();
        foreach (var target in targets)
        {
            var eligibleRoles = await permissionAnalyzer.FindLeastPrivilegedRoles(userId, activity, target, allRoles);
            suggestedRoles.AddRange(eligibleRoles);
        }

        return [.. suggestedRoles.Distinct()];
    }

    public async Task<SuggestedRoleChanges> GetSuggestedRoleChanges(Activity activity, IEnumerable<ReviewTargetResource> targets, string userId)
    {
        var suggestedRoles = await GetSuggestedRoles(activity, targets, userId);
        var currentUserRoles = await roleService.GetUserRolesAsync(userId);
        
        var rolesToAdd = suggestedRoles.Where(r => !currentUserRoles.Any(cr => cr.Id == r.Id)).ToList();
        var rolesToRemove = currentUserRoles.Where(cr => !suggestedRoles.Any(sr => sr.Id == cr.Id)).ToList();
        return new SuggestedRoleChanges
        {
            RolesToAdd = rolesToAdd,
            RolesToRemove = rolesToRemove
        };
    }
}
