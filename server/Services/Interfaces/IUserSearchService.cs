namespace RoleReaper.Services;

public interface IUserSearchService
{
    Task<IEnumerable<DirectoryItem>> SearchAsync(string query, bool includeGroups);
}
