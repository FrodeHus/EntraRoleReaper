using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Models;

public enum ReviewJobStatus
{
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled
}

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

public record ReviewJobResult(
    List<ActivityReviewResult>? Results
);
