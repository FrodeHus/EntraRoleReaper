using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review;

public class RoleEvaluationService(IUserService userService, IRoleService roleService, IEnumerable<IEvaluateRole> evaluators, IEnumerable<IRoleRequirement>? roleRequirements = null)
{
    public async Task<(UserContext,RoleEvaluationResult)> Evaluate(string userId, Guid tenantId, ActivityDto activity, List<ReviewTargetResource> targets)
    {
        var userContext = await userService.GetUserById(userId, tenantId);
        var roles = await roleService.GetAllRolesAsync();
        var results = new List<RoleEvaluationResult>();
        foreach (var context in from role in roles from target in targets select new RoleEvaluationContext(role, activity, target, userContext))
        {
            var result = await EvaluateAsync(context);
            results.Add(result);
        }
        return (userContext, results.OrderByDescending(r => r.TotalScore).FirstOrDefault() ?? new RoleEvaluationResult(new RoleDefinitionDto(), -1000, []));
    }

    private async Task<RoleEvaluationResult> EvaluateAsync(RoleEvaluationContext context)
    {
        if (!MeetsAllRequirements(context))
        {
            return new RoleEvaluationResult(context.RoleDefinition, -1000, []);
        }

        var roleScoreCards = new List<RoleScoreCard>();
        foreach (var evaluator in evaluators)
        {
            var scoreCard = await evaluator.Evaluate(context);
            roleScoreCards.Add(scoreCard);
        }

        var score = roleScoreCards.Sum(r => r.Score);
        return new RoleEvaluationResult(context.RoleDefinition, score, roleScoreCards);
    }

    private bool MeetsAllRequirements(RoleEvaluationContext context)
    {
        return roleRequirements?.Any() != true || roleRequirements.All(requirement => requirement.IsSatisfied(context));
    }
}

public record RoleEvaluationResult(object RoleDefinition, int TotalScore, IEnumerable<RoleScoreCard> RoleScoreCards);