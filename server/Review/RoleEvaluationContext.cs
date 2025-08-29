namespace EntraRoleReaper.Api.Review;

public class RoleEvaluationContext(object roleDefinition, object targetResource, UserContext userContext)
{
    public Dictionary<string, object> Properties { get; } = [];
    public object RoleDefinition { get; } = roleDefinition;
    public object TargetResource { get; } = targetResource;
    public UserContext User { get; } = userContext;
}