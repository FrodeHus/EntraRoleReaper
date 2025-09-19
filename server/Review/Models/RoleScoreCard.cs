namespace EntraRoleReaper.Api.Review.Models;

public class RoleScoreCard
{
    public required string EvaluatorName { get; set; }
    public int Score { get; set; }
    public required string Justification { get; set; }
}

