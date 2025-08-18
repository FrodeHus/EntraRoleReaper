using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class Tenant
{
    public Guid Id { get; set; }
    [MaxLength(100)]
    public string? Name { get; set; }
    [MaxLength(100)]
    public string? TenantDomain { get; set; }
    public DateTime CreatedAt { get; set; }
}