namespace EntraRoleReaper.Api.Services.Interfaces;

public interface IOperationMapCache
{
    Task InitializeAsync(bool forceRefresh = false);
    Task RefreshAsync();
    IReadOnlyDictionary<string, string[]> GetAll();
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, string[]>> GetPropertyMap();
}
