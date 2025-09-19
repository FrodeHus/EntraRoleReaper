using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Review.Models;

[System.Diagnostics.DebuggerDisplay("ReviewTargetResource: {DisplayName} ({Type})")]
public class ReviewTargetResource
{
    public required string Id { get; set; }
    public required string Type { get; set; }
    public required string DisplayName { get; set; }
    public IReadOnlyList<ModifiedProperty>? ModifiedProperties { get; set; }
}