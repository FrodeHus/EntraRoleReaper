using System.Diagnostics;

namespace EntraRoleReaper.Api.Services.Models;

[DebuggerDisplay("ModifiedProperty: {DisplayName}")]
public record ModifiedProperty(string? DisplayName);

[DebuggerDisplay("ReviewTarget: {DisplayName} ({Type})")]
public record ReviewTarget(
    string? Id,
    string? DisplayName,
    string? Type,
    string? Label,
    IReadOnlyList<ModifiedProperty>? ModifiedProperties = null,
    string? UserPrincipalName = null
);
