namespace EntraRoleReaper.Api.Services.Models;

public record ModifiedProperty(string? DisplayName);

public record ReviewTarget(
    string? Id,
    string? DisplayName,
    string? Type,
    string? Label,
    IReadOnlyList<ModifiedProperty>? ModifiedProperties = null,
    string? UserPrincipalName = null
);
