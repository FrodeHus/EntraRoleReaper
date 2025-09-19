using EntraRoleReaper.Api.Modules.Entra.Graph.Audit.Models;

namespace EntraRoleReaper.Api.Review.Models;

public record ActivityReviewResult(Activity Activity, RoleEvaluationResult EvaluationResult);
