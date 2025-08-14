using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Services;

namespace EntraRoleReaper.Tests;
internal class SimpleRoleService(params string[] userRoleNames) : IRoleService
{
    private readonly List<RoleDefinition> _roles = new List<RoleDefinition>
        {
        new() {
                DisplayName = "Groups Administrator",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceAction> {
                            new() { Action = "/groups/members/update", IsPrivileged = true },
                        },
                        IsPrivileged = true
                    }
                ],
            },
            new() {
                DisplayName = "Global Administrator",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceAction> {
                            new() { Action = "/users/allProperties/allTasks", IsPrivileged = true },
                            new() { Action = "/groups/allProperties/allTasks", IsPrivileged = true },
                        },
                        IsPrivileged = true
                    }
                ],
            },
                        new() {
                DisplayName = "User",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceAction> {
                            new() { Action = "/users/basicprofile/read" },
                        },
                        Condition = ""
                    },
                    new() {
                        ResourceActions = new List<ResourceAction> {
                            new() { Action = "/users/basicprofile/update" },
                            new() { Action = "/users/authenticationMethods/update", IsPrivileged = true },
                        },
                        Condition = "$ResourceIsSelf"
                    },
                    new() {
                        ResourceActions = new List<ResourceAction> {
                            new() { Action = "/groups/members/update" },
                        },
                        Condition = "$SubjectIsOwner"
                    }
                ],
            }

        };
    public Task AddRoleAsync(RoleDefinition role)
    {
        throw new NotImplementedException();
    }

    public Task<List<RoleDefinition>> GetAllRolesAsync()
    {
        return Task.FromResult(_roles);
    }

    public Task<RoleDefinition?> GetRoleByIdAsync(string roleId)
    {
        var role = _roles.FirstOrDefault(r => r.Id.ToString() == roleId);
        return Task.FromResult(role);
    }

    public Task<RoleDefinition?> GetRoleByNameAsync(string roleName)
    {
        var role = _roles.FirstOrDefault(r => r.DisplayName.Equals(roleName, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(role);
    }

    public Task<IEnumerable<RoleDefinition>> GetUserRolesAsync(string userId)
    {
        return Task.FromResult(_roles.Where(r => userRoleNames.Contains(r.DisplayName)));
    }

    public Task InitializeAsync(bool forceRefresh = false)
    {
        throw new NotImplementedException();
    }

    public Task<IEnumerable<RoleDefinition>> SearchRolesAsync(string? searchTerm, bool privilegedOnly = false, int limit = 100)
    {
        throw new NotImplementedException();
    }

    public Task UpdateRoleAsync(RoleDefinition role)
    {
        throw new NotImplementedException();
    }
}
