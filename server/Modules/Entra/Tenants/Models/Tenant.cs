using System.ComponentModel.DataAnnotations;
using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Modules.Entra.Tenants.Models;

public class Tenant : Entity
{
    [MaxLength(100)]
    public string? Name { get; set; }
    [MaxLength(100)]
    public string? TenantDomain { get; set; }
}