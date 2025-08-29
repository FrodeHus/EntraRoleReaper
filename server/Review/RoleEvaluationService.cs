using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Review;

public class RoleEvaluationService(IEnumerable<IEvaluateRoleRequirement> evaluators)
{
    public async Task<RoleEvaluationResult> EvaluateAsync(RoleEvaluationContext context)
    {
        var roleScoreCards = new List<RoleScoreCard>();
        foreach (var evaluator in evaluators)
        {
            var scoreCard = await evaluator.Evaluate(context);
            roleScoreCards.Add(scoreCard);
        }
        var score = roleScoreCards.Sum(r => r.Score);
        return new RoleEvaluationResult(score, roleScoreCards);
    }
}

public record RoleEvaluationResult(int TotalScore, IEnumerable<RoleScoreCard> RoleScoreCards);