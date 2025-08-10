namespace RoleReaper.Services;

public record UserReview(
    string UserId,
    string UserDisplayName,
    string[] CurrentRoleIds,
    string[] EligibleRoleIds,
    string[] UsedOperations,
    string[] SuggestedRoleIds,
    IReadOnlyList<SuggestedRole> SuggestedRoles,
    int OperationCount,
    IReadOnlyList<ReviewOperation> Operations,
    IReadOnlyList<RoleMeta> RoleMeta
);
