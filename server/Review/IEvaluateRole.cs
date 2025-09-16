using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Review;

public interface IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context);
}
