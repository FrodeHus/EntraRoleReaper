using EntraRoleReaper.Api.Review;
using EntraRoleReaper.Api.Review.Models;
using Moq;

namespace EntraRoleReaper.Tests.Review;
public class EvaluationTests
{
    [Fact]
    public async Task It_Can_Run_Multiple_Evaluators()
    {
        // Arrange
        var targetResource = new Mock<ReviewTargetResource>();
        var nameEvaluatorMock = new Mock<IEvaluateRole>();
        nameEvaluatorMock.Setup(e => e.Evaluate(It.IsAny<RoleEvaluationContext>()))
            .Returns(Task.FromResult(new RoleScoreCard { Score = 1, Justification = "" }))
            .Verifiable();
        var privilegedEvaluatorMock = new Mock<IEvaluateRole>();
        privilegedEvaluatorMock.Setup(e => e.Evaluate(It.IsAny<RoleEvaluationContext>()))
            .Returns(Task.FromResult(new RoleScoreCard { Score = 2, Justification = "" }))
            .Verifiable();

        var evaluators = new List<IEvaluateRole>
        {
            privilegedEvaluatorMock.Object,
            nameEvaluatorMock.Object
        };

        var userService = new Mock<IUserService>();
        userService.Setup(u => u.GetCurrentUser()).ReturnsAsync(new UserContext { UserId = "test" , TenantId = Guid.NewGuid()});
        var roleEvaluationService = new RoleEvaluationService(userService.Object, evaluators);
        var role = new { Name = "Test Role" };

        // Act
        var result = await roleEvaluationService.EvaluateRole(role, targetResource.Object);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.TotalScore);
        Assert.Equal(2, result.RoleScoreCards.Count());
    }

    [Fact]
    public async Task It_Can_Filter_Out_Roles_Not_Applicable()
    {
        // Arrange
        var role = new MockRole
        {
            Name = "Not valid role"
        };

        var roleRequirement = new Mock<IRoleRequirement>();
        var userService = new Mock<IUserService>();
        userService.Setup(u => u.GetCurrentUser()).ReturnsAsync(new UserContext { UserId = "test" , TenantId = Guid.NewGuid()});
        var roleEvaluationService = new RoleEvaluationService(userService.Object, [], [roleRequirement.Object]);
        roleRequirement.Setup(e => e.IsSatisfied(It.Is<RoleEvaluationContext>(r => ((MockRole)r.RoleDefinition).Name == "MockRole"))).Returns(true);
        // Act
        var result = await roleEvaluationService.EvaluateRole(role, null);
        // Assert
        Assert.Equal(-1000, result.TotalScore);
    }

    private class MockRole
    {
        public string Name { get; set; } = "MockRole";
    }
}
