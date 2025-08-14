using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;

namespace EntraRoleReaper.Api.Services;

public interface IRoleService
{
    Task InitializeAsync(bool forceRefresh = false);
    Task<List<RoleDefinition>> GetAllRolesAsync();
    Task<RoleDefinition?> GetRoleByIdAsync(string roleId);
    Task<RoleDefinition?> GetRoleByNameAsync(string roleName);
    Task UpdateRoleAsync(RoleDefinition role);
    Task AddRoleAsync(RoleDefinition role);

    Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string? searchTerm, bool privilegedOnly = false, int limit = 100);
}

public class RoleService(IRoleRepository roleRepository, IResourceActionRepository resourceActionRepository, GraphService graphService, ILogger<RoleService> logger) : IRoleService
{
    public async Task InitializeAsync(bool forceRefresh = false)
    {
        if(await roleRepository.GetRoleCountAsync() > 0 && !forceRefresh)
        {
            logger.LogInformation("Roles already initialized, skipping initialization.");
            return;
        }
        try
        {
            await roleRepository.ClearAsync();
            var roles = await graphService.GetAllRoleDefinitions();
            if (roles == null || !roles.Any())
            {
                logger.LogInformation("No roles found in Graph API, skipping initialization.");
                return;
            }
            logger.LogInformation("Initializing roles from Graph API, found {RoleCount} roles.", roles.Count);
            var resourceActionMetadata = await graphService.GetResourceActionMetadataAsync();
            foreach (var role in roles)
            {
                var existingRole = await roleRepository.GetRoleByIdAsync(role.Id);
                if (existingRole == null)
                {
                    var roleDefinition = new RoleDefinition
                    {
                        Id = Guid.Parse(role.Id),
                        DisplayName = role.DisplayName ?? role.Id,
                        Description = role.Description ?? string.Empty,
                        PermissionSets = role.RolePermissions.Select(p => new PermissionSet
                        {
                            Condition = p.Condition,
                            ResourceActions = p.AllowedResourceActions?.Select(ra => new ResourceAction
                            {
                                Action = ra,
                                IsPrivileged = resourceActionMetadata[ra]
                            }).ToList()
                        }).ToList()
                    };
                    await roleRepository.AddRoleAsync(roleDefinition);
                    logger.LogInformation("Added new role: {RoleName}", role.DisplayName);
                }
                else
                {
                    logger.LogInformation("Role already exists: {RoleName}", existingRole.DisplayName);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize roles from Graph API");
            throw;
        }
    }
    public async Task<List<RoleDefinition>> GetAllRolesAsync()
    {
        try
        {
            return await roleRepository.GetAllRolesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve all roles");
            throw;
        }
    }

    public async Task<RoleDefinition?> GetRoleByIdAsync(string roleId)
    {
        try
        {
            return await roleRepository.GetRoleByIdAsync(roleId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve role by ID: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<RoleDefinition?> GetRoleByNameAsync(string roleName)
    {
        try
        {
            return await roleRepository.GetRoleByNameAsync(roleName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve role by name: {RoleName}", roleName);
            throw;
        }
    }

    public async Task UpdateRoleAsync(RoleDefinition role)
    {
        try
        {
            await roleRepository.UpdateRoleAsync(role);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update role: {RoleName}", role.DisplayName);
            throw;
        }
    }

    public async Task AddRoleAsync(RoleDefinition role)
    {
        try
        {
            await roleRepository.AddRoleAsync(role);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to add new role: {RoleName}", role.DisplayName);
            throw;
        }
    }

    public async Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string? searchTerm, bool privilegedOnly = false, int limit = 100)
    {
        if (string.IsNullOrEmpty(searchTerm))
        {
            return await roleRepository.GetAllRolesAsync();
        }
        try
        {
            return await roleRepository.SearchRolesAsync(searchTerm, privilegedOnly, limit);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to search roles with term: {SearchTerm}", searchTerm);
            return [];
        }
    }
}