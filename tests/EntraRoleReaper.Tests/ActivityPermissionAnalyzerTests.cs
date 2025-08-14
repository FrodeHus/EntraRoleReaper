using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Tests;
public partial class ActivityPermissionAnalyzerTests
{
    private readonly List<RoleDefinition> _roles;
    public ActivityPermissionAnalyzerTests() => _roles = new List<RoleDefinition>
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
    [Fact]
    public void FindRelevantRoles_Should_Return_Only_Relevant_Roles()
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
                    Action = "/users/allProperties/allTasks",
                    IsPrivileged = true
                },
                new() {
                    Action = "/users/basicprofile/update",
                    IsPrivileged = false
                }
            ],
        };
        // Act
        var result = analyzer.FindRelevantRoles(activity, _roles);
        // Assert
        Assert.Equal(2, result.Count()); // Expecting two roles to match the activity permissions
        Assert.Contains(result, r => r.DisplayName == "Global Administrator");
        Assert.Contains(result, r => r.DisplayName == "User");
    }

    [Fact]
    public async Task EnsureConditions_Resource_Is_Self()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService(new Dictionary<string, bool> { { "currentUser", true } }));
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
        var target = new AuditTargetResource
        {
            Id = "currentUser",
            DisplayName = "User A",
            Type = "User"
        };
        // Act
        var result = await analyzer.EnsureConditionsAreMet("currentUser", activity, target, _roles);
        // Assert
        Assert.Equal(2, result.Count()); // Expecting two roles to match the activity permissions
        Assert.Contains(result, r => r.DisplayName == "Global Administrator");
        Assert.Contains(result, r => r.DisplayName == "User");
    }

    [Fact]
    public async Task EnsureConditions_Resource_Is_Not_Self()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService(new Dictionary<string, bool> { { "currentUser", true } }));
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
        var target = new AuditTargetResource
        {
            Id = "userA",
            DisplayName = "User A",
            Type = "User"
        };
        // Act
        var result = await analyzer.EnsureConditionsAreMet("currentUser", activity, target, _roles);
        // Assert
        Assert.Single(result);
        Assert.Contains(result, r => r.DisplayName == "Global Administrator");
    }

    [Fact]
    public async Task EnsureConditions_Subject_Is_Owner()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService(new Dictionary<string, bool> { { "groupA", true } }));
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Add member to group",

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
        var target = new AuditTargetResource
        {
            Id = "groupA",
            DisplayName = "User A",
            Type = "group"
        };
        // Act
        var result = await analyzer.EnsureConditionsAreMet("currentUser", activity, target, _roles);
        // Assert
        Assert.Equal(3, result.Count());
        Assert.Contains(result, r => r.DisplayName == "Global Administrator");
        Assert.Contains(result, r => r.DisplayName == "Groups Administrator");
        Assert.Contains(result, r => r.DisplayName == "User");
    }

    [Fact]
    public async Task EnsureConditions_Subject_Is_Not_Owner()
    {
        // Arrange
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService(new Dictionary<string, bool> { { "groupA", false } }));
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Add member to group",

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
        var target = new AuditTargetResource
        {
            Id = "groupA",
            DisplayName = "User A",
            Type = "group"
        };
        // Act
        var result = await analyzer.EnsureConditionsAreMet("currentUser", activity, target, _roles);
        // Assert
        Assert.Equal(2, result.Count());
        Assert.Contains(result, r => r.DisplayName == "Global Administrator");
        Assert.Contains(result, r => r.DisplayName == "Groups Administrator");
    }
}
