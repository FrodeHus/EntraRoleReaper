using System.Reflection;
using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Dto;
using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models; // added for Activity

namespace EntraRoleReaper.Tests;

public partial class ActivityPermissionAnalyzerTests
{
    private static IEnumerable<RoleGrant> InvokeOrderRolesByRelevance(ActivityPermissionAnalyzer analyzer, IEnumerable<RoleGrant> roleGrants, Activity activity)
    {
        var method = typeof(ActivityPermissionAnalyzer).GetMethod("OrderRolesByRelevance", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);
        var result = method!.Invoke(analyzer, [roleGrants, activity]);
        return Assert.IsAssignableFrom<IEnumerable<RoleGrant>>(result);
    }

    [Fact]
    public void OrderRolesByRelevance_Returns_All_When_No_RelevanceMatches()
    {
        // Arrange: actions use leading slash (current implementation mismatch between namespaceAndResources and actionCountByResource keys)
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService([]));
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Dummy",
            MappedResourceActions =
            [
                new() { Action = "/users/basicprofile/update" },
                new() { Action = "/groups/members/update" }
            ]
        };
        var roles = new List<RoleGrant>
        {
            new() { Role = new RoleDefinitionDto { Id = Guid.NewGuid(), DisplayName = "RoleA", PermissionSets = [ new() { ResourceActions = [ new() { Action = "/users/basicprofile/update" } ] } ] }, Condition = "$Tenant" },
            new() { Role = new RoleDefinitionDto { Id = Guid.NewGuid(), DisplayName = "RoleB", PermissionSets = [ new() { ResourceActions = [ new() { Action = "/groups/members/update" } ] } ] }, Condition = "$Tenant" }
        };

        // Act
        var ordered = InvokeOrderRolesByRelevance(analyzer, roles, activity).ToList();

        // Assert: all roles returned (single relevance bucket)
        Assert.Equal(roles.Count, ordered.Count);
        Assert.Contains(ordered, r => r.Role.DisplayName == "RoleA");
        Assert.Contains(ordered, r => r.Role.DisplayName == "RoleB");
    }

    [Fact]
    public void OrderRolesByRelevance_Skips_Role_With_Missing_PermissionSet()
    {
        // Arrange: RoleB has no null-condition permission set although Condition = $Tenant -> skipped
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService([]));
        var activity = new Activity { Id = Guid.NewGuid(), Name = "Dummy", MappedResourceActions = [ new() { Action = "/users/basicprofile/update" } ] };
        var roles = new List<RoleGrant>
        {
            new() { Role = new RoleDefinitionDto { Id = Guid.NewGuid(), DisplayName = "RoleA", PermissionSets = [ new() { ResourceActions = [ new() { Action = "/users/basicprofile/update" } ] } ] }, Condition = "$Tenant" },
            new() { Role = new RoleDefinitionDto { Id = Guid.NewGuid(), DisplayName = "RoleB", PermissionSets = [ new() { Condition = "$SubjectIsOwner", ResourceActions = [ new() { Action = "/users/basicprofile/update" } ] } ] }, Condition = "$Tenant" }
        };

        // Act
        var ordered = InvokeOrderRolesByRelevance(analyzer, roles, activity).ToList();

        // Assert: RoleB excluded
        Assert.Single(ordered);
        Assert.Equal("RoleA", ordered[0].Role.DisplayName);
    }

    [Fact]
    public void OrderRolesByRelevance_Returns_Only_Highest_RelevanceScore_Group()
    {
        // Arrange: Use actions without leading slash to create matching keys for relevance score differentiation
        var analyzer = new ActivityPermissionAnalyzer(new SimpleGraphService([]));
        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            Name = "Update user",
            MappedResourceActions =
            [
                new() { Action = "users/basicprofile/update" }
            ]
        };
        // RoleHigh fully focused on the namespace/resource -> score 1.0
        var roleHigh = new RoleGrant
        {
            Role = new RoleDefinitionDto
            {
                Id = Guid.NewGuid(),
                DisplayName = "High",
                PermissionSets =
                [
                    new() { ResourceActions = [ new() { Action = "users/basicprofile/update" } ] }
                ]
            },
            Condition = "$Tenant"
        };
        // RoleLow has extra unrelated action -> score 0.5
        var roleLow = new RoleGrant
        {
            Role = new RoleDefinitionDto
            {
                Id = Guid.NewGuid(),
                DisplayName = "Low",
                PermissionSets =
                [
                    new() { ResourceActions = [ new() { Action = "users/basicprofile/update" }, new() { Action = "groups/members/add" } ] }
                ]
            },
            Condition = "$Tenant"
        };

        var roles = new List<RoleGrant> { roleLow, roleHigh }; // Intentionally low first to verify ordering selects only highest scoring bucket

        // Act
        var ordered = InvokeOrderRolesByRelevance(analyzer, roles, activity).ToList();

        // Assert: only High returned
        Assert.Single(ordered);
        Assert.Equal("High", ordered[0].Role.DisplayName);
    }
}
