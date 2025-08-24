using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public record ActivityDto(Guid Id, string ActivityName, string? Category = null, string? Service = null, ICollection<TargetResourceDto>? TargetResources = null)
{

    public static ActivityDto FromActivity(Activity activity, bool includeProperties = false)
    {
        var dto = new ActivityDto(
            Id: activity.Id,
            ActivityName: activity.Name,
            Category: activity.AuditCategory,
            Service: activity.Service
        );

        if (includeProperties)
        {
            return dto with
            {
                TargetResources = activity.TargetResources?.Select(TargetResourceDto.FromTargetResource).ToList()
            };
        }
        return dto;
    }
}