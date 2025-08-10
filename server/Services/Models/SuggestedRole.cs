namespace EntraRoleAssignmentAuditor.Services;

public record SuggestedRole(
    string Name,
    int CoveredRequired,
    int PrivilegedAllowed,
    int TotalAllowed
);
