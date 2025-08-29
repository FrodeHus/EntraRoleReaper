namespace EntraRoleReaper.Api.Review.Models;

public class RoleScoreCard
{
    public Guid RoleDefinitionId { get; set; }
    public int Score { get; set; }
    public ICollection<RoleRequirement> Requirements { get; set; } = [];
}

public class RoleRequirement
{
    public string Requirement { get; set; } = string.Empty;
    public bool IsMet { get; set; }
    public int MaxScore { get; set; }
    public int Score { get; set; }
}