namespace EntraRoleAssignmentAuditor.Services;

public record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);
