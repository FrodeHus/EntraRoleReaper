using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IReviewService
{
    Task<ReviewResponse> ReviewAsync(ReviewRequest request);
}
