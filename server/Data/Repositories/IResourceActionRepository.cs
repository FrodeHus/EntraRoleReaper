using EntraRoleReaper.Api.Data.Models;

namespace EntraRoleReaper.Api.Data.Repositories;
public interface IResourceActionRepository
{
    Task<ResourceAction> AddAsync(ResourceAction resourceAction);
    Task<ResourceAction?> GetResourceActionByIdAsync(Guid id);
    Task<ResourceAction?> GetResourceActionByNameAsync(string name);
}