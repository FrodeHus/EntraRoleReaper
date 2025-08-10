namespace EntraRoleAssignmentAuditor.Services;

public interface IReviewService
{
    Task<ReviewResponse> ReviewAsync(ReviewRequest request);
}
