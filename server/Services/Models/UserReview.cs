namespace EntraRoleReaper.Api.Services.Models;

public record SimpleUser(string Id, string DisplayName, List<SimpleRole>? CurrentActiveRoles, List<SimpleRole>? CurrentEligiblePimRoles);

public record OperationModifiedProperty(string? DisplayName, string? OldValue, string? NewValue);

public record OperationTarget(
    string? Id,
    string? DisplayName,
    IReadOnlyList<OperationModifiedProperty>? ModifiedProperties = null
);

public record OperationPermission(
    string Name,
    bool IsPrivileged,
    IReadOnlyList<string> GrantedByRoleIds,
    IReadOnlyList<string>? GrantConditions,
    IReadOnlyList<string>? MatchedConditionsPerRole
);

public record OperationReview(
    string Operation,
    IReadOnlyList<OperationTarget> Targets,
    IReadOnlyList<OperationPermission> Permissions
);

public record SimpleRole(string Id, string DisplayName);

// New simplified UserReview per updated contract
public record UserReview(
    SimpleUser User,
    IReadOnlyList<OperationReview> Operations,
    IReadOnlyList<SimpleRole> AddedRoles,
    IReadOnlyList<SimpleRole> RemovedRoles
);
