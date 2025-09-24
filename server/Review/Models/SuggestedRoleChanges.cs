using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;

namespace EntraRoleReaper.Api.Review.Models;

public class SuggestedRoleChanges
{
    public IEnumerable<RoleDefinition> RolesToAdd { get; set; } = [];
    public IEnumerable<RoleDefinition> RolesToRemove { get; set; } = [];
    public IEnumerable<RoleDefinition> RolesToKeep { get; set; } = [];
}
