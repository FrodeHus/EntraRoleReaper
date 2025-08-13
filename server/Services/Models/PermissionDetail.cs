namespace EntraRoleReaper.Api.Services.Models;

public record PermissionDetail(
    string Name,
    bool Privileged,
    IReadOnlyList<string> GrantedByRoles,
    IReadOnlyList<string>? GrantConditions,
    IReadOnlyList<string>? MatchedConditionsPerRole // parallel to GrantedByRoles capturing the specific matched condition (or empty string if none)
);
