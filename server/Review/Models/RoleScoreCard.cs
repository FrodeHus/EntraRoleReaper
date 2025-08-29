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
    public int Score { get; set; }
}

public class TargetIsOwnerRequirement : RoleRequirement
{
    public TargetIsOwnerRequirement()
    {
        Requirement = "Role has at least one owner";
        Score = 20;
    }
}

public class RoleHasHighNumberOfPrivilegedActionsRequirement : RoleRequirement
{
    public int PrivilegedActionCount { get; set; }
    public int Threshold { get; set; }

    public RoleHasHighNumberOfPrivilegedActionsRequirement(int privilegedActionCount, int threshold = 4)
    {
        PrivilegedActionCount = privilegedActionCount;
        Threshold = threshold;
        Requirement = $"Role has a high number of privileged actions (>{Threshold})";
        Score = 10;
        IsMet = PrivilegedActionCount <= Threshold;
    }
}

public class RoleHasNoPrivilegedActionsRequirement : RoleRequirement
{
    public RoleHasNoPrivilegedActionsRequirement()
    {
        Requirement = "Role has no privileged actions";
        Score = 30;
    }
}