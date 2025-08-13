namespace EntraRoleReaper.Api.Services.Models;

public record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);
