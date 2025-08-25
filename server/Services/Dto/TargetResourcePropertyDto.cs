namespace EntraRoleReaper.Api.Services.Dto;

public record TargetResourcePropertyDto(
    Guid Id,
    string PropertyName,
    bool IsSensitive,
    string? Description)
{
    public static TargetResourcePropertyDto FromTargetResourceProperty(Data.Models.TargetResourceProperty? property)
    {
        if (property == null)
        {
            return new TargetResourcePropertyDto(Guid.Empty, string.Empty, false, null);
        }
        return new TargetResourcePropertyDto(
            property.Id,
            property.PropertyName,
            property.IsSensitive,
            property.Description);
    }
}