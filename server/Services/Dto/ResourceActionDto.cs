using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Services.Dto;

public class ResourceActionDto
{
    public Guid Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Description { get; set; } = string.Empty;
    public string? ActionVerb { get; set; } = string.Empty;
    public bool IsPrivileged { get; set; }
    public string Namespace
    {
        get
        {
            var parts = Action.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 1)
            {
                return string.Join('/', parts[0]);
            }
            return string.Empty;
        }
    }

    public string ResourceGroup
    {
        get
        {
            var parts = Action.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 2)
            {
                return parts[1];
            }
            return string.Empty;
        }
    }

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