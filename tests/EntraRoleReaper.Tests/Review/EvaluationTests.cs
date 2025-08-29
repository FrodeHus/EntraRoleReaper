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
        var nameEvaluatorMock = new Mock<IEvaluateRoleRequirement>();
        nameEvaluatorMock.Setup(e => e.Evaluate(It.IsAny<RoleEvaluationContext>()))
            .Returns(Task.FromResult(new RoleScoreCard { Score = 1 }))
            .Verifiable();
        var privilegedEvaluatorMock = new Mock<IEvaluateRoleRequirement>();
        privilegedEvaluatorMock.Setup(e => e.Evaluate(It.IsAny<RoleEvaluationContext>()))
            .Returns(Task.FromResult(new RoleScoreCard { Score = 2 }))
            .Verifiable();

        var evaluators = new List<IEvaluateRoleRequirement>
        {
            privilegedEvaluatorMock.Object,
            nameEvaluatorMock.Object
        };

        var roleEvaluationService = new RoleEvaluationService(evaluators);
        var role = new { Name = "Test Role" };

        // Act
        var result = await roleEvaluationService.EvaluateAsync(new RoleEvaluationContext(role, targetResource.Object, new UserContext { UserId = "test" }));

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.TotalScore);
        Assert.Equal(2, result.RoleScoreCards.Count());
    }
}
