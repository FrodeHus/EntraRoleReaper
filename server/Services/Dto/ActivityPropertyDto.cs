using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public record ActivityPropertyDto(Guid Id, string Name)
{
    public static ActivityPropertyDto FromActivityProperty(ActivityProperty property)
    {
        return new ActivityPropertyDto(property.Id, property.Name);
    }
}