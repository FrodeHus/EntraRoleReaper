using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public class RoleDefinitionDto
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsBuiltIn { get; set; }
    public bool IsEnabled { get; set; }
    public List<PermissionSetDto> PermissionSets { get; set; } = new();
    public Guid? TenantId { get; set; }

    public static RoleDefinitionDto? FromRoleDefinition(RoleDefinition? role)
    {
        if (role == null)
        {
            return null;
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
                ResourceActions = ps.ResourceActions?.Select(ra => new ResourceActionDto
                {
                    Action = ra.Action,
                    IsPrivileged = ra.IsPrivileged
                }).ToList() ?? new List<ResourceActionDto>()
            }).ToList(),
            TenantId = role.TenantId
        };
    }
}