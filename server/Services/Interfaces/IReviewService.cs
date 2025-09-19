using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IReviewService
{
    Task<List<UserReviewResult>> ReviewAsync(List<string> usersOrGroups, DateTimeOffset from, DateTimeOffset to, Guid tenantId);
}
