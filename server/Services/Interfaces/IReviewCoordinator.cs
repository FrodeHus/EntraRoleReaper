using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IReviewCoordinator
{
    Guid Enqueue(ReviewJob job, string? userAccessToken = null);
    ReviewJob? Get(Guid id);
    IReadOnlyCollection<ReviewJob> List(Guid? tenantId = null);
    Task RunPendingAsync(CancellationToken ct = default);
    (bool success, string? error) Cancel(Guid id, string requestedBy);
}
