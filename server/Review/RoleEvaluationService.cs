using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Review;

public class RoleEvaluationService(IEnumerable<IEvaluateRole> evaluators, IEnumerable<IRoleRequirement>? roleRequirements = null)
{
    public async Task<RoleEvaluationResult> EvaluateAsync(RoleEvaluationContext context)
    {
        if (!MeetsAllRequirements(context))
        {
            return new RoleEvaluationResult(-1000, Array.Empty<RoleScoreCard>());
        }

        var roleScoreCards = new List<RoleScoreCard>();
        foreach (var evaluator in evaluators)
        {
            var scoreCard = await evaluator.Evaluate(context);
            roleScoreCards.Add(scoreCard);
        }

        var score = roleScoreCards.Sum(r => r.Score);
        return new RoleEvaluationResult(score, roleScoreCards);
    }

    private bool MeetsAllRequirements(RoleEvaluationContext context)
    {
        if (roleRequirements?.Any() != true)
        {
            return true;
        }
        foreach (var requirement in roleRequirements)
        {
            if (!requirement.IsSatisfied(context))
            {
                return false;
            }
        }
        return true;
    }
}

public record RoleEvaluationResult(int TotalScore, IEnumerable<RoleScoreCard> RoleScoreCards);