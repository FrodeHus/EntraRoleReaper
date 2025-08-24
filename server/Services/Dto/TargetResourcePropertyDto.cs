namespace EntraRoleReaper.Api.Services.Dto;

public class TargetResourcePropertyDto(
    Guid Id,
    string PropertyName,
    bool IsSensitive,
    string? DisplayName,
    string? Description)
{
    public static TargetResourcePropertyDto FromTargetResourceProperty(Data.Models.TargetResourceProperty? property)
    {
        if (property == null)
        {
            return new TargetResourcePropertyDto(Guid.Empty, string.Empty, false, null, null);
        }
        return new TargetResourcePropertyDto(
            property.Id,
            property.PropertyName,
            property.IsSensitive,
            property.DisplayName,
            property.Description);
    }
}