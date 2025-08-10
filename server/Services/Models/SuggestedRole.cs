namespace EntraRoleAssignmentAuditor.Services;

public record SuggestedRole(
    string Id,
    string Name,
    int CoveredRequired,
    int PrivilegedAllowed,
    int TotalAllowed
);
