using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class ResourceIsSelfEvaluator : IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.TargetResource is not ReviewTargetResource target)
        {
            throw new ArgumentException("Target resource is not of type ReviewTargetResource");
        }
        if (context.User.UserId.Equals(target.Id))
        {
            return Task.FromResult(new RoleScoreCard
            {
                EvaluatorName = nameof(ResourceIsSelfEvaluator),
                Score = 100,
                Justification = "User is the same as the target resource"
            });
        }
        else
        {
            return Task.FromResult(new RoleScoreCard { EvaluatorName = nameof(ResourceIsSelfEvaluator), Score = 0, Justification = "User is not the same as the target resource" });
        }
    }
}
