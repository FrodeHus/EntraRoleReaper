using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IReviewCoordinator
{
    Guid Enqueue(Guid tenantId, string requestedBy, ReviewRequest request, string? userAccessToken = null);
    bool ExistsDuplicate(string requestedBy, ReviewRequest request);
    ReviewJob? Get(Guid id);
    IReadOnlyCollection<ReviewJob> List(Guid? tenantId = null);
    Task RunPendingAsync(CancellationToken ct = default);
    (bool success, string? error) Cancel(Guid id, string requestedBy);
}
