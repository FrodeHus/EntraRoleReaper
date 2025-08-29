using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review;

namespace EntraRoleReaper.Api.Modules.Entra.RoleRequirements;

public class ResourceActionRequirement(IEnumerable<ResourceAction> requiredActions) : IRoleRequirement
{
    public bool IsSatisfied(RoleEvaluationContext context)
    {
        if (context.RoleDefinition is not RoleDefinition roleDef)
        {
            return false;
        }
        var resourceActions = roleDef.PermissionSets.SelectMany(ps => ps.ResourceActions ?? []).ToList();
        return requiredActions.Any(resourceActions.Contains);
    }
}
