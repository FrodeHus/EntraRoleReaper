using EntraRoleReaper.Api.Configuration.PermissionMapping.Models;
using Microsoft.EntityFrameworkCore;
using RoleReaper.Data;
using RoleReaper.Services;
using Xunit;

namespace EntraRoleReaper.Tests;

public class MappingTests
{
    private static CacheDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<CacheDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .EnableSensitiveDataLogging()
            .Options;
        var db = new CacheDbContext(opts);
        // Seed some resource actions
        db.ResourceActions.Add(
            new ResourceActionEntity { Action = "/reaper/config/create", IsPrivileged = false }
        );
        db.ResourceActions.Add(
            new ResourceActionEntity { Action = "/reaper/config/update", IsPrivileged = true }
        );
        db.ResourceActions.Add(
            new ResourceActionEntity { Action = "/reaper/config/delete", IsPrivileged = false }
        );
        db.SaveChanges();
        return db;
    }

    private sealed class NoopOpCache : IOperationMapCache
    {
        public IReadOnlyDictionary<string, string[]> GetAll() => new Dictionary<string, string[]>();

        public IReadOnlyDictionary<
            string,
            IReadOnlyDictionary<string, string[]>
        > GetPropertyMap() => new Dictionary<string, IReadOnlyDictionary<string, string[]>>();

        public Task InitializeAsync(bool forceRefresh = false) => Task.CompletedTask;

        public Task RefreshAsync() => Task.CompletedTask;
    }

    [Fact]
    public async Task ImportAsync_Creates_Base_And_Property_Mappings()
    {
        // Arrange
        using var db = CreateDb();
        var svc = new OperationMappingService(db, new NoopOpCache());
        var maps = new List<OperationMap>
        {
            new OperationMap
            {
                Operation = "Create config",
                ResourceActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "/reaper/config/create",
                },
                Properties = new List<PropertyMap>
                {
                    new PropertyMap
                    {
                        ResourceAction = "/reaper/config/update",
                        Properties = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                        {
                            "field",
                            "value",
                        },
                    },
                    new PropertyMap
                    {
                        ResourceAction = "/reaper/config/delete",
                        Properties = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                        {
                            "credentials",
                        },
                    },
                },
            },
        };

        // Act
        var result = await svc.ImportAsync(maps);

        // Assert
        Assert.Equal(1, result.Created);
        // Each distinct property becomes a row after inversion: displayName, id, password => 3
        Assert.Equal(3, result.PropertyCreated);
        Assert.Equal(3, db.OperationPropertyMaps.Count());
        Assert.Empty(result.UnknownActions);
        var op = db.OperationMaps.Include(o => o.ResourceActions).Single();
        Assert.Equal("Create config", op.OperationName);
        Assert.Single(op.ResourceActions);
    }

    [Fact]
    public async Task ImportAsync_Unknown_Actions_Are_Returned()
    {
        using var db = CreateDb();
        var svc = new OperationMappingService(db, new NoopOpCache());
        var maps = new List<OperationMap>
        {
            new OperationMap
            {
                Operation = "DoStuff",
                ResourceActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Non.Existing",
                },
            },
        };

        var result = await svc.ImportAsync(maps);

        Assert.Single(result.UnknownActions);
        Assert.Equal("Non.Existing", result.UnknownActions[0]);
        // Operation still created but with no linked actions
        var op = db.OperationMaps.Include(o => o.ResourceActions).Single();
        Assert.Empty(op.ResourceActions);
    }

    [Fact]
    public async Task ImportAsync_Replaces_Existing_Mappings()
    {
        using var db = CreateDb();
        var svc = new OperationMappingService(db, new NoopOpCache());
        // Initial import
        await svc.ImportAsync(
            new[]
            {
                new OperationMap
                {
                    Operation = "Op1",
                    ResourceActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "User.Read.All",
                    },
                },
            }
        );
        Assert.Equal(1, db.OperationMaps.Count());
        // Second import replaces
        await svc.ImportAsync(
            [
                new OperationMap
                {
                    Operation = "Op2",
                    ResourceActions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "Group.Read.All",
                    },
                },
            ]
        );
        Assert.Equal(1, db.OperationMaps.Count());
        Assert.Equal("Op2", db.OperationMaps.Single().OperationName);
    }

    [Fact]
    public async Task ImportAsync_Empty_List_Clears_Existing()
    {
        using var db = CreateDb();
        var svc = new OperationMappingService(db, new NoopOpCache());
        await svc.ImportAsync(new[] { new OperationMap { Operation = "Op1" } });
        Assert.Equal(1, db.OperationMaps.Count());
        await svc.ImportAsync(Array.Empty<OperationMap>());
        Assert.Equal(0, db.OperationMaps.Count());
    }
}
