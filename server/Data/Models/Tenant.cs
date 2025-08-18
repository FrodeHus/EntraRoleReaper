using System.ComponentModel.DataAnnotations;

namespace EntraRoleReaper.Api.Data.Models;

public class Tenant : Entity
{
    [MaxLength(100)]
    public string? Name { get; set; }
    [MaxLength(100)]
    public string? TenantDomain { get; set; }
}