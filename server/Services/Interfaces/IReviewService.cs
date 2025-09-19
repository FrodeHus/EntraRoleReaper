using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IReviewService
{
    Task<List<ActivityReviewResult>> ReviewAsync(List<string> usersOrGroups, DateTimeOffset from, DateTimeOffset to, Guid tenantId);
}
