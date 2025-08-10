namespace RoleReaper.Services;

public record ReviewRequest(List<string> UsersOrGroups, DateTimeOffset From, DateTimeOffset To);
