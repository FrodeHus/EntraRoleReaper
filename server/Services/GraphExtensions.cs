using Microsoft.Graph.Models;

namespace EntraRoleReaper.Api.Services;

public enum PermissionCondition
{
    None,
    ResourceIsSelf,
    SubjectIsOwner
}

public static class GraphExtensions
{
    public static UnifiedRolePermission? GetUnifiedRolePermissionBy(this UnifiedRoleDefinition roleDefinition, PermissionCondition condition)
    {
        return condition switch
        {
            PermissionCondition.ResourceIsSelf => roleDefinition.RolePermissions?.SingleOrDefault(p => p.Condition == "$ResourceIsSelf"),
            PermissionCondition.SubjectIsOwner => roleDefinition.RolePermissions?.SingleOrDefault(p => p.Condition == "$SubjectIsOwner"),
            _ => roleDefinition.RolePermissions?.FirstOrDefault()
        };
    }
    
    public static bool HasResourceAction(this UnifiedRolePermission permission, string action)
    {
        return permission.AllowedResourceActions?.Any(a => a.Equals(action, StringComparison.OrdinalIgnoreCase)) ?? false;
    }
}