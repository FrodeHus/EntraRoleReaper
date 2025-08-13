using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;

namespace EntraRoleReaper.Api.Services;

public class RoleService(IRoleRepository roleRepository, GraphService graphService, ILogger<RoleService> logger)
{
    public async Task InitializeAsync()
    {
        if(await roleRepository.GetRoleCountAsync() > 0)
        {
            logger.LogInformation("Roles already initialized, skipping initialization.");
            return;
        }
        try
        {
            var roles = await graphService.GetAllRoleDefinitions();
            if (roles == null || !roles.Any())
            {
                logger.LogInformation("No roles found in Graph API, skipping initialization.");
                return;
            }
            logger.LogInformation("Initializing roles from Graph API, found {RoleCount} roles.", roles.Count);
            foreach (var role in roles)
            {
                var existingRole = await roleRepository.GetRoleByIdAsync(role.Id);
                if (existingRole == null)
                {
                    var roleDefinition = new RoleDefinition
                    {
                        Id = Guid.Parse(role.Id),
                        DisplayName = role.DisplayName,
                        Description = role.Description,
                        PermissionSets = role.RolePermissions.Select(p => new PermissionSet
                        {
                            Condition = p.Condition,
                            ResourceActions = p.AllowedResourceActions?.Select(ra => new ResourceAction
                            {
                                Action = ra
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
}