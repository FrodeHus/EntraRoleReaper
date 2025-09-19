namespace EntraRoleReaper.Api.Services.Models;

public record ReviewJob(
    Guid Id,
    string RequestedBy,
    List<string> UsersOrGroups,
    DateTimeOffset AuditFrom,
    DateTimeOffset AuditTo,
    Guid TenantId,
    DateTimeOffset EnqueuedAt,
    string? UserAccessToken = null
)
{
    public ReviewJobStatus Status { get; set; } = ReviewJobStatus.Queued;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? Error { get; set; }
    public ReviewJobResult? Result { get; set; }
}