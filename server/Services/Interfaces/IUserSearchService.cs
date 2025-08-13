using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IUserSearchService
{
    Task<IEnumerable<DirectoryItem>> SearchAsync(string query, bool includeGroups);
}
