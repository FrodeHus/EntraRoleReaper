using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class ResourceAction
{
    public Guid Id { get; init; }
    public Guid PermissionSetId { get; init; }
    [MaxLength(255)]
    public string Action { get; init; } = string.Empty; // unique
    public bool IsPrivileged { get; init; }
}
