using EntraRoleReaper.Api.Review.Models;

namespace EntraRoleReaper.Api.Services.Models;

public record ReviewJobResult(
    List<UserReviewResult>? Results
);