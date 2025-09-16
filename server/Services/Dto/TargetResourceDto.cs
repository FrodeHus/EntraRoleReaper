using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public record TargetResourceDto(
    Guid Id,
    string ResourceType,
    List<TargetResourcePropertyDto> Properties
)
{

    public static TargetResourceDto? FromTargetResource(TargetResource? resource)
    {
        if (resource == null)
        {
            return null;
        }
        return new TargetResourceDto(
            resource.Id,
            resource.ResourceType,
            [.. resource.Properties.Select(TargetResourcePropertyDto.FromTargetResourceProperty)]
        );
    }
}
