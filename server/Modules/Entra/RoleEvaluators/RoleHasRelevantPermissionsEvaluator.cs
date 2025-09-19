using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class RoleHasRelevantPermissionsEvaluator : IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.Activity is not ActivityDto entraActivity)
        {
            throw new InvalidOperationException("Activity is not of type ActivityDto");
        }

        if (context.RoleDefinition is not RoleDefinitionDto roleDefinition)
            throw new InvalidOperationException("RoleDefinition is not of type RoleDefinitionDto");

        var rolePermissions = roleDefinition.PermissionSets.FirstOrDefault(ps => ps.Condition == null)?.ResourceActions ?? [];
        var totalActions = rolePermissions?.Count ?? 0;
        var matchingActions = entraActivity.ResourceActions?.Count(ra => rolePermissions != null && rolePermissions.Any(r => r.Action == ra.Action)) ?? 0;
        var score = totalActions == 0 ? 0 : (int)((matchingActions / (double)totalActions) * 1000);
        return Task.FromResult(new RoleScoreCard
        {
            Score = score,
            Justification = $"Role has {matchingActions} out of {totalActions} relevant permissions for the activity"
        });
    }
}