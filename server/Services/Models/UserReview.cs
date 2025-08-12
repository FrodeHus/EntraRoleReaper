namespace RoleReaper.Services;

public record SimpleUser(string Id, string DisplayName);

public record OperationTarget(string? Id, string? DisplayName);

public record OperationPermission(
    string Name,
    bool IsPrivileged,
    IReadOnlyList<string> GrantedByRoleIds
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
    IReadOnlyList<SimpleRole> ActiveRoles,
    IReadOnlyList<SimpleRole> EligiblePimRoles,
    IReadOnlyList<OperationReview> Operations,
    IReadOnlyList<SimpleRole> AddedRoles,
    IReadOnlyList<SimpleRole> RemovedRoles
);
