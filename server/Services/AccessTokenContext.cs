namespace EntraRoleReaper.Api.Services;

// Scoped context to flow the user's bearer token into background work
public class AccessTokenContext
{
    public string? UserAccessToken { get; set; }
}
