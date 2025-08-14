using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;
public interface IResourceActionRepository
{
    Task<ResourceAction> AddAsync(ResourceAction resourceAction);
    Task<ResourceAction?> GetResourceActionByIdAsync(Guid id);
    Task<ResourceAction?> GetResourceActionByNameAsync(string name);
    Task<IEnumerable<ResourceAction>> SearchResourceActionsAsync(string searchTerm, int limit = 100);

    Task<ICollection<ResourceAction>> GetResourceActionsByIdsAsync(Guid[] resourceActionIds);
    Task<ICollection<ResourceAction>> GetResourceActionsByNamesAsync(IEnumerable<string> allResourceActions);
}