using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

[Index(nameof(Action), IsUnique = true)]
public class ResourceAction : Entity
{
    [MaxLength(255)]
    public string Action { get; init; } = string.Empty; // unique
    public bool IsPrivileged { get; init; }
}
