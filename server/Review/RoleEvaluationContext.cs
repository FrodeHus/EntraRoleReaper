using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Review;

public class RoleEvaluationContext(object roleDefinition, object activity, object targetResource, UserContext userContext)
{
    public Dictionary<string, object> Properties { get; } = [];
    public object RoleDefinition { get; } = roleDefinition;
    public object TargetResource { get; } = targetResource;
    public object Activity { get; } = activity;
    public UserContext User { get; } = userContext;
    public List<RoleScoreCard> CompletedEvaluations { get; } = [];
}