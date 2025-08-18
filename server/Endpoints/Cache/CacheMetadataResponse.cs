namespace EntraRoleReaper.Api.Endpoints.Cache;

internal record CacheMetadataResponse(
    DateTime? LastUpdatedUtc,
    int RoleCount,
    int ActionCount
);