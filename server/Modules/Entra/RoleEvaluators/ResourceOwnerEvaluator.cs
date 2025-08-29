using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class ResourceOwnerEvaluator(IGraphService graphService) : IEvaluateRoleRequirement
{
    public async Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.TargetResource is not ReviewTargetResource target)
        {
            throw new ArgumentException("Target resource must be of type ReviewTargetResource", nameof(context.TargetResource));
        }
        var isOwner = await graphService.IsOwnerAsync(context.User.UserId.ToString()!, target);

        return new RoleScoreCard
        {
            Score = isOwner ? 100 : 0,
            Justification = isOwner ? "User is an owner of the resource" : "User is not an owner of the resource"
        };
    }
}
