using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Tests;
public partial class ActivityPermissionAnalyzerTests
{
    private readonly List<RoleDefinitionDto> _roles;
    public ActivityPermissionAnalyzerTests() => _roles = new List<RoleDefinitionDto>
        {
        new() {
                DisplayName = "Groups Administrator",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceActionDto> {
                            new() { Action = "/groups/members/update", IsPrivileged = true },
                        }
                    }
                ],
            },
            new() {
                DisplayName = "Global Administrator",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceActionDto> {
                            new() { Action = "/users/allProperties/allTasks", IsPrivileged = true },
                            new() { Action = "/groups/allProperties/allTasks", IsPrivileged = true },
                        }
                    }
                ],
            },
                        new() {
                DisplayName = "User",
                Id = Guid.NewGuid(),
                PermissionSets =
                [
                    new() {
                        ResourceActions = new List<ResourceActionDto> {
                            new() { Action = "/users/basicprofile/read" },
                        },
                        Condition = ""
                    },
                    new() {
                        ResourceActions = new List<ResourceActionDto> {
                            new() { Action = "/users/basicprofile/update" },
                            new() { Action = "/users/authenticationMethods/update", IsPrivileged = true },
                        },
                        Condition = "$ResourceIsSelf"
                    },
                    new() {
                        ResourceActions = new List<ResourceActionDto> {
                            new() { Action = "/groups/members/update" },
                        },
                        Condition = "$SubjectIsOwner"
                    }
                ],
            }

        };

    [Fact]
    public async Task Resource_Is_Self_Should_Return_Least_Privileged_Roles()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService([]));
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
        var target = new ReviewTargetResource
        {
            Id = "currentUser",
            DisplayName = "User A",
            Type = "user"
        };
        // Act
        var result = await analyzer.FindLeastPrivilegedRoles("currentUser", activity, target, _roles);
        // Assert
        Assert.Single(result); // Expecting only the User role to be returned as it has the least privilege for the actions
        Assert.Contains(result, r => r.Role.DisplayName == "User");
    }

    [Fact]
    public async Task Resource_Is_Not_Self_Should_Return_Least_Privileged_Roles()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService([]));
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
        var target = new ReviewTargetResource
        {
            Id = "userA",
            DisplayName = "User A",
            Type = "user"
        };
        // Act
        var result = await analyzer.FindLeastPrivilegedRoles("currentUser", activity, target, _roles);
        // Assert
        Assert.Single(result); // Expecting only the User role to be returned as it has the least privilege for the actions
        Assert.Contains(result, r => r.Role.DisplayName == "Global Administrator");
    }

    [Fact]
    public async Task Subject_Is_Owner_Should_Return_Least_Privileged_Roles()
    {
        // Arrange
        ActivityPermissionAnalyzer analyzer = new(new SimpleGraphService(new Dictionary<string, bool> { { "groupA", true } }));
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
        var target = new ReviewTargetResource
        {
            Id = "groupA",
            DisplayName = "User A",
            Type = "group"
        };
        // Act
        var result = await analyzer.FindLeastPrivilegedRoles("currentUser", activity, target, _roles);
        // Assert
        Assert.Single(result); // Expecting only the User role to be returned as it has the least privilege for the actions
        Assert.Contains(result, r => r.Role.DisplayName == "User");
    }

    [Fact]
    public async Task Subject_Is_Not_Owner_Should_Return_Least_Privileged_Roles()
    {
        // Arrange
        ActivityPermissionAnalyzer analyzer = new(new SimpleGraphService(new Dictionary<string, bool> { { "groupA", false } }));
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
        var target = new ReviewTargetResource
        {
            Id = "groupA",
            DisplayName = "User A",
            Type = "group"
        };
        // Act
        var result = await analyzer.FindLeastPrivilegedRoles("currentUser", activity, target, _roles);
        // Assert
        Assert.Equal(2, result.Count());
        Assert.Equal("Groups Administrator", result.First().Role.DisplayName);
    }
}
