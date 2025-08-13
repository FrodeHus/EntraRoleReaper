namespace EntraRoleReaper.Api.Data.Models;

public class ResourceAction
{
    public Guid Id { get; set; }
    public Guid PermissionSetId { get; set; }
    public string Action { get; set; } = string.Empty; // unique
    public bool IsPrivileged { get; set; }
}
