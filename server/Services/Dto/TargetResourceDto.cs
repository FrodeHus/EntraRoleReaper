namespace EntraRoleReaper.Api.Services.Dto;

public record TargetResourceDto(
    Guid Id,
    string ResourceType,
    string? DisplayName,
    string? Description,
    List<TargetResourcePropertyDto> Properties
)
{

    public static TargetResourceDto? FromTargetResource(Data.Models.TargetResource? resource)
    {
        if (resource == null)
        {
            return null;
        }
        return new TargetResourceDto(
            resource.Id,
            resource.ResourceType,
            resource.DisplayName,
            resource.Description,
            [.. resource.Properties.Select(TargetResourcePropertyDto.FromTargetResourceProperty)]
        );
    }
}
