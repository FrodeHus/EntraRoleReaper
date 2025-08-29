namespace EntraRoleReaper.Api.Review;

public interface IRoleRequirement
{
    bool IsSatisfied(RoleEvaluationContext context);
}