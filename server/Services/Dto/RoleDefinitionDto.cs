namespace EntraRoleReaper.Api.Services.Dto;

public class RoleDefinitionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsBuiltIn { get; set; }
    public bool IsEnabled { get; set; }
    public List<PermissionSetDto> PermissionSets { get; set; } = new();
    public Guid? TenantId { get; set; }
    
}

public class PermissionSetDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Condition { get; set; }
    public List<ResourceActionDto> ResourceActions { get; set; } = new();
}

public class ResourceActionDto
{
    public string Resource { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public bool IsPrivileged { get; set; }
}