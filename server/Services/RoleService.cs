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

    Task<IEnumerable<RoleDefinition>>
        SearchRolesAsync(string? searchTerm, bool privilegedOnly = false, int limit = 100);

    Task<IEnumerable<RoleDefinition>> GetUserRolesAsync(string userId);
}

public class RoleService(
    IRoleRepository roleRepository,
    IGraphService graphService,
    IResourceActionRepository resourceActionRepository,
    ITenantService tenantService,
    ILogger<RoleService> logger) : IRoleService
{
    public async Task InitializeAsync(bool forceRefresh = false)
    {
        if (await roleRepository.GetRoleCountAsync() > 0 && !forceRefresh)
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

            roles = roles.Distinct().ToList();

            logger.LogInformation("Initializing roles from Graph API, found {RoleCount} roles.", roles.Count);
            var resourceActionMetadata = await graphService.GetResourceActionMetadataAsync();
            var resourceActions = resourceActionMetadata.Select(kvp => new ResourceAction
            {
                Action = kvp.Key,
                IsPrivileged = kvp.Value
            }).ToList();
            var addedResourceActions = await resourceActionRepository.AddRangeAsync(resourceActions);
            var addedRoles = new List<RoleDefinition>();
            foreach (var role in roles)
            {
                var roleDefinition = new RoleDefinition
                {
                    Id = Guid.Parse(role.Id!),
                    DisplayName = role.DisplayName ?? role.Id!,
                    Description = role.Description ?? string.Empty,
                    IsBuiltIn = role.IsBuiltIn ?? false,
                    IsEnabled = role.IsEnabled ?? false,
                    PermissionSets = (role.RolePermissions ?? []).Select(p => new PermissionSet
                    {
                        Condition = p.Condition,
                        ResourceActions = p.AllowedResourceActions
                            ?.Select(ra => addedResourceActions.First(a => a.Action == ra)).ToList()
                    }).ToList()
                };
                if (!roleDefinition.IsBuiltIn)
                {
                    var tenant = await tenantService.GetCurrentTenantAsync();
                    roleDefinition.TenantId = tenant?.Id;
                }
                addedRoles.Add(roleDefinition);
                logger.LogInformation("Added new role: {RoleName}", role.DisplayName);
            }
            var distinctRoles = addedRoles
                .GroupBy(r => r.DisplayName)
                .Select(g => g.First())
                .ToList();
            await roleRepository.AddRangeAsync(addedRoles);
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
            var tenant = await tenantService.GetCurrentTenantAsync();
            return await roleRepository.GetAllRolesAsync(tenant?.Id);
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

    public async Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string? searchTerm, bool privilegedOnly = false,
        int limit = 100)
    {
        if (string.IsNullOrEmpty(searchTerm))
        {
            var tenant = await tenantService.GetCurrentTenantAsync();
            return await roleRepository.GetAllRolesAsync(tenant?.Id);
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

    public async Task<IEnumerable<RoleDefinition>> GetUserRolesAsync(string userId)
    {
        var ctx = await graphService.GetUserAndRolesAsync(userId);
        var userRoleIds = ctx.ActiveRoleIds;
        userRoleIds.AddRange(ctx.EligibleRoleIds);
        userRoleIds.AddRange(ctx.PimActiveRoleIds);
        userRoleIds = [.. userRoleIds.Distinct()];
        var userRoles = new List<RoleDefinition>();
        foreach (var roleId in userRoleIds)
        {
            var role = await GetRoleByIdAsync(roleId);
            if (role != null)
            {
                userRoles.Add(role);
            }
        }

        return userRoles;
    }
}