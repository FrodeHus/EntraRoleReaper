namespace EntraRoleReaper.Api.Data.Models;

public abstract class Entity
{
    public Guid Id { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedUtc { get; set; }
    public DateTime? DeletedUtc { get; set; }
    public bool IsDeleted => DeletedUtc.HasValue;
}