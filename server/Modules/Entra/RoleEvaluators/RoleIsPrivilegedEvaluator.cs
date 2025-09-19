using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class RoleIsPrivilegedEvaluator : IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.RoleDefinition is not RoleDefinitionDto role)
            return Task.FromResult(new RoleScoreCard
            {
                Score = -1000,
                Justification = "RoleDefinition is not of type RoleDefinitionDto"
            });
     
        return Task.FromResult(new RoleScoreCard
        {
            Score = role.IsPrivileged ? -100 : 0,
            Justification = role.IsPrivileged ? "Role is privileged" : "Role is not privileged"
        });
    }
}