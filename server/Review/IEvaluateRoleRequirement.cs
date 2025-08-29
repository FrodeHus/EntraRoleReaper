using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Review;

public interface IEvaluateRoleRequirement
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context);
}
