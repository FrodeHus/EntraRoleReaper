namespace EntraRoleAssignmentAuditor.Services;

public record PermissionDetail(string Name, bool Privileged, IReadOnlyList<string> GrantedByRoles);
