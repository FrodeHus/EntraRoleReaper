using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Modules.Entra.RoleEvaluators;

public class RoleRelatesToEntityEvaluator : IEvaluateRole
{
    public Task<RoleScoreCard> Evaluate(RoleEvaluationContext context)
    {
        if (context.RoleDefinition is not RoleDefinitionDto role)
            throw new InvalidOperationException("RoleDefinition is not of type RoleDefinitionDto");
        if(context.Activity is not ActivityDto activity)
            throw new InvalidOperationException("Activity is not of type ActivityDto");
        var mappedResourceActions = activity.ResourceActions?.Select(ra => ra.Action).ToHashSet() ?? [];
        if(mappedResourceActions.Count == 0)
        {
            return Task.FromResult(new RoleScoreCard
            {
                EvaluatorName = nameof(RoleRelatesToEntityEvaluator),
                Score = 0,
                Justification = "No resource actions found for activity"
            });
        }
        
        var namespaceAndEntity = mappedResourceActions.Select(ra => ra.Split('/').Take(2).Aggregate("", (current, next) => current + next + "/").TrimEnd('/')).Distinct().ToList() ?? [];
        
        var rolePermissions = role.PermissionSets.FirstOrDefault(p => p.Condition == null)?.ResourceActions.ToList() ?? [];
        if(rolePermissions.Count == 0)
        {
            return Task.FromResult(new RoleScoreCard
            {
                EvaluatorName = nameof(RoleRelatesToEntityEvaluator),
                Score = 0,
                Justification = "Role has no permissions"
            });
        }
        
        var numberOfPermissionsForEntity = rolePermissions.Count(rp => namespaceAndEntity.Any(ne => rp.Action.StartsWith(ne)));

        return Task.FromResult(new RoleScoreCard
        {
            EvaluatorName = nameof(RoleRelatesToEntityEvaluator),
            Score = (int)(numberOfPermissionsForEntity / (double)rolePermissions.Count * 1000),
            Justification = "Role has " + numberOfPermissionsForEntity + " out of " + rolePermissions.Count + " permissions related to the activity entity"
        });
    }
}