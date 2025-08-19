namespace EntraRoleReaper.Api.Services.Dto;

public class PermissionSetDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Condition { get; set; }
    public List<ResourceActionDto> ResourceActions { get; set; } = new();
}