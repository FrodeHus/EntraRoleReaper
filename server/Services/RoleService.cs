using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Data.Repositories;
using EntraRoleReaper.Api.Modules.Entra.Graph.Common;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Services;

public interface IRoleService
{
    Task InitializeAsync(bool forceRefresh = false);
    Task<List<RoleDefinitionDto>> GetAllRolesAsync();
    Task<RoleDefinitionDto?> GetRoleByIdAsync(Guid roleId);
    Task<RoleDefinitionDto?> GetRoleByNameAsync(string roleName);
    Task UpdateRoleAsync(RoleDefinition role);
    Task AddRoleAsync(RoleDefinition role);

    Task<IEnumerable<RoleDefinitionDto>>
        SearchRolesAsync(string? searchTerm, bool privilegedOnly = false, int limit = 100);

    Task<IEnumerable<RoleDefinitionDto>> GetUserRolesAsync(string userId);
}

public class RoleService(
    IRoleRepository roleRepository,
    IGraphService graphService,
    ReaperDbContext dbContext,
    ITenantService tenantService,
    ILogger<RoleService> logger) : UnitOfWorkService(dbContext, logger), IRoleService
{
    private readonly ResourceActionRepository _resourceActionRepository = new(dbContext);
    public async Task InitializeAsync(bool forceRefresh = false)
    {
        if (await roleRepository.GetRoleCountAsync() > 0 && !forceRefresh)
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

            roles = roles.Distinct().ToList();

            logger.LogInformation("Initializing roles from Graph API, found {RoleCount} roles.", roles.Count);
            var resourceActionMetadata = await graphService.GetResourceActionMetadataAsync();
            var resourceActions = resourceActionMetadata.Select(ra => new ResourceAction
            {
                Action = ra.Action,
                IsPrivileged = ra.IsPrivileged,
                Description = ra.Description,
                ActionVerb = ra.ActionVerb
            }).ToList();
            var addedResourceActions = _resourceActionRepository.AddRange(resourceActions);
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
            await SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize roles from Graph API");
            throw;
        }
    }

    public async Task<List<RoleDefinitionDto>> GetAllRolesAsync()
    {
        try
        {
            var tenant = await tenantService.GetCurrentTenantAsync();
            var roles = await roleRepository.GetAllRolesAsync(tenant?.Id);
            return roles.ConvertAll(RoleDefinitionDto.FromRoleDefinition);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve all roles");
            throw;
        }
    }

    public async Task<RoleDefinitionDto?> GetRoleByIdAsync(Guid roleId)
    {
        try
        {
            var role = await roleRepository.GetRoleByIdAsync(roleId);
            if (role == null)
            {
                logger.LogWarning("Role not found for ID: {RoleId}", roleId);
                return null;
            }
            return RoleDefinitionDto.FromRoleDefinition(role);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve role by ID: {RoleId}", roleId);
            throw;
        }
    }

    public async Task<RoleDefinitionDto?> GetRoleByNameAsync(string roleName)
    {
        try
        {
            var role = await roleRepository.GetRoleByNameAsync(roleName);
            return RoleDefinitionDto.FromRoleDefinition(role);
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

    public async Task<IEnumerable<RoleDefinitionDto>> SearchRolesAsync(string? searchTerm, bool privilegedOnly = false,
        int limit = 100)
    {
        if (string.IsNullOrEmpty(searchTerm))
        {
            var tenant = await tenantService.GetCurrentTenantAsync();
            var roles = await roleRepository.GetAllRolesAsync(tenant?.Id);
            return roles.ConvertAll(RoleDefinitionDto.FromRoleDefinition);
        }

        try
        {
            var roles = await roleRepository.SearchRolesAsync(searchTerm, privilegedOnly, limit);
            return roles.Select(RoleDefinitionDto.FromRoleDefinition).ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to search roles with term: {SearchTerm}", searchTerm);
            return [];
        }
    }

    public async Task<IEnumerable<RoleDefinitionDto>> GetUserRolesAsync(string userId)
    {
        var ctx = await graphService.GetUserAndRolesAsync(userId);
        var userRoleIds = ctx.ActiveRoleIds;
        userRoleIds.AddRange(ctx.EligibleRoleIds);
        userRoleIds.AddRange(ctx.PimActiveRoleIds);
        userRoleIds = [.. userRoleIds.Distinct()];
        var userRoles = new List<RoleDefinitionDto>();
        foreach (var roleId in userRoleIds)
        {
            var id = Guid.Parse(roleId);
            var role = await GetRoleByIdAsync(id);
            if (role != null)
            {
                userRoles.Add(role);
            }
        }

        return userRoles;
    }

    public async Task CreateCustomRole()
    {
        
    }
}