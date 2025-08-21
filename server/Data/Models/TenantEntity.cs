namespace EntraRoleReaper.Api.Data.Models;

public abstract class TenantEntity : Entity
{
    public Guid? TenantId { get; set; }
}