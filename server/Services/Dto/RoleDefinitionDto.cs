using EntraRoleReaper.Api.Data.Models;
using System.Diagnostics;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;

namespace EntraRoleReaper.Api.Services.Dto;

[DebuggerDisplay("RoleDefinition: {DisplayName} ({IsPrivileged})")]
public class RoleDefinitionDto
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsBuiltIn { get; set; }
    public bool IsEnabled { get; set; }
    public List<PermissionSetDto> PermissionSets { get; set; } = new();
    public Guid? TenantId { get; set; }
    public bool IsPrivileged => PermissionSets.Any(ps => ps.ResourceActions?.Any(ra => ra.IsPrivileged) == true);

    public static RoleDefinitionDto FromRoleDefinition(RoleDefinition? role)
    {
        if (role == null)
        {
            return new RoleDefinitionDto();
        }
        return new RoleDefinitionDto
        {
            Id = role.Id,
            DisplayName = role.DisplayName,
            Description = role.Description,
            IsBuiltIn = role.IsBuiltIn,
            IsEnabled = role.IsEnabled,
            PermissionSets = role.PermissionSets.Select(ps => new PermissionSetDto
            {
                Id = ps.Id,
                Name = ps.Name,
                Condition = ps.Condition,
                ResourceActions = ps.ResourceActions?.Select(ResourceActionDto.FromResourceAction).ToList() ?? []
            }).ToList(),
            TenantId = role.TenantId
        };
    }
}