namespace RoleReaper.Services;

public record PermissionDetail(
    string Name,
    bool Privileged,
    IReadOnlyList<string> GrantedByRoles,
    IReadOnlyList<string>? GrantConditions // parallel to GrantedByRoles (condition per granting role) or aggregate unique list
);
