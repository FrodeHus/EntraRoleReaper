namespace EntraRoleReaper.Api.Services.Models;

public record ReviewOperation(
    string Operation,
    string[] RequiredPermissions,
    IReadOnlyList<ReviewTarget> Targets,
    IReadOnlyList<PermissionDetail> PermissionDetails
);
