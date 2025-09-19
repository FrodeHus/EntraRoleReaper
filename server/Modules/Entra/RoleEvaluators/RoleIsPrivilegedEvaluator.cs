using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class RoleIsPrivilegedEvaluator : IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.RoleDefinition is not RoleDefinitionDto role)
            throw new InvalidOperationException("RoleDefinition is not of type RoleDefinitionDto");
     
        return Task.FromResult(new RoleScoreCard
        {
            EvaluatorName = nameof(RoleIsPrivilegedEvaluator),
            Score = role.IsPrivileged ? -50 : 50,
            Justification = role.IsPrivileged ? "Role is privileged" : "Role is not privileged"
        });
    }
}