using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;
using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review.Models;

public record ActivityReviewResult(ActivityDto Activity, RoleEvaluationResult? EvaluationResult);
public record UserReviewResult(UserContext User, List<ActivityReviewResult> ActivityResults);
