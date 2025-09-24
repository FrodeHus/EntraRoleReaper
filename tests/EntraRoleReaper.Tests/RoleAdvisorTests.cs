using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Modules.Entra.Roles.Models;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Tests;
public class RoleAdvisorTests
{
    [Fact]
    public async Task Subject_Is_Owner_Should_Return_User_Role()
    {
        // Arrange
        var roleService = new SimpleRoleService("User", "Global Administrator");
        var graphService = new SimpleGraphService(new Dictionary<string, bool> { { "target1", true }, { "target2", true } });
        var permissionAnalyzer = new ActivityPermissionAnalyzer(graphService);
        var roleAdvisor = new RoleAdvisor(permissionAnalyzer, roleService);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Add user to group",
            MappedResourceActions =
            [
                new() {
                    Action = "/groups/members/update",
                    IsPrivileged = false
                },
                new() {
                    Action = "/groups/allProperties/allTasks",
                    IsPrivileged = true
                }
            ],
        };
        var target1 = new ReviewTargetResource
        {
            Id = "target1",
            DisplayName = "Target Resource 1",
            Type = "group"
        };
        var target2 = new ReviewTargetResource
        {
            Id = "target2",
            DisplayName = "Target Resource 2",
            Type = "group"
        };
        var targets = new List<ReviewTargetResource> { target1, target2 };
        // Act
        var suggestedRoles = await roleAdvisor.GetSuggestedRoles(activity, targets, "userId");
        // Assert
        // Verify the expected outcome
        Assert.Single(suggestedRoles);
        Assert.Contains(suggestedRoles, r => r.DisplayName == "User");
    }

    [Fact]
    public async Task Resource_Is_Self_Should_Return_User_Role()
    {
        // Arrange
        var roleService = new SimpleRoleService("User", "Global Administrator");
        var graphService = new SimpleGraphService(new Dictionary<string, bool> { { "target1", true }, { "target2", false } });
        var permissionAnalyzer = new ActivityPermissionAnalyzer(graphService);
        var roleAdvisor = new RoleAdvisor(permissionAnalyzer, roleService);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Update user",
            MappedResourceActions =
            [
                new() {
                Action = "/users/basicprofile/update",
                IsPrivileged = false
            },
            new() {
                Action = "/users/allProperties/allTasks",
                IsPrivileged = true
            }
            ],
        };
        var target1 = new ReviewTargetResource
        {
            Id = "user1",
            DisplayName = "Target Resource 1",
            Type = "user"
        };
        var targets = new List<ReviewTargetResource> { target1 };
        // Act
        var suggestedRoles = await roleAdvisor.GetSuggestedRoles(activity, targets, "user1");
        // Assert
        // Verify the expected outcome
        Assert.Single(suggestedRoles);
        Assert.Contains(suggestedRoles, r => r.DisplayName == "User");
    }
    [Fact]
    public async Task Subject_Is_Not_Owner_For_All_Should_Return_Tenant_Roles()
    {
        // Arrange
        var roleService = new SimpleRoleService("User", "Global Administrator");
        var graphService = new SimpleGraphService(new Dictionary<string, bool> { { "target1", true }, { "target2", false } });
        var permissionAnalyzer = new ActivityPermissionAnalyzer(graphService);
        var roleAdvisor = new RoleAdvisor(permissionAnalyzer, roleService);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Add user to group",
            MappedResourceActions =
            [
                new() {
                Action = "/groups/members/update",
                IsPrivileged = false
            },
            new() {
                Action = "/groups/allProperties/allTasks",
                IsPrivileged = true
            }
            ],
        };
        var target1 = new ReviewTargetResource
        {
            Id = "target1",
            DisplayName = "Target Resource 1",
            Type = "group"
        };
        var target2 = new ReviewTargetResource
        {
            Id = "target2",
            DisplayName = "Target Resource 2",
            Type = "group"
        };
        var targets = new List<ReviewTargetResource> { target1, target2 };
        // Act
        var suggestedRoles = await roleAdvisor.GetSuggestedRoles(activity, targets, "userId");
        // Assert
        // Verify the expected outcome
        Assert.Equal(2, suggestedRoles.Count);
        Assert.Contains(suggestedRoles, r => r.DisplayName == "Global Administrator");
        Assert.Contains(suggestedRoles, r => r.DisplayName == "Groups Administrator");
    }

    [Fact]
    public async Task ConsolidateRoles_Should_Return_Least_Privilege_Roles_With_Requested_ResourceActions()
    {
        var roleService = new SimpleRoleService();
        var graphService = new SimpleGraphService(new Dictionary<string, bool> { { "target1", true }, { "target2", false } });
        var permissionAnalyzer = new ActivityPermissionAnalyzer(graphService);
        var roleAdvisor = new RoleAdvisor(permissionAnalyzer, roleService);
        var requestedActions = new List<ResourceAction>
        {
            new ResourceAction { Action = "/groups/members/update", IsPrivileged = false },
            new ResourceAction { Action = "/groups/allProperties/allTasks", IsPrivileged = true },
            new ResourceAction { Action = "/users/allProperties/allTasks", IsPrivileged = true },
            new ResourceAction { Action = "/users/basicprofile/update", IsPrivileged = false }
        };

        var roles = roleAdvisor.ConsolidateRoles(await roleService.GetAllRolesAsync(), requestedActions);
        Assert.Equal(2, roles.Count);
    }
}
