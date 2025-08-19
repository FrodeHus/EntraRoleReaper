using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public class ResourceActionDto
{
    public Guid Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public bool IsPrivileged { get; set; }
    
    public static ResourceActionDto FromResourceAction(ResourceAction? action)
    {
        if (action == null)
        {
            return new ResourceActionDto();
        }
        return new ResourceActionDto
        {
            Id = action.Id,
            Action = action.Action,
            IsPrivileged = action.IsPrivileged
        };
    }
}