namespace EntraRoleReaper.Api.Services;

public interface ITokenProtector
{
    string? Protect(string? plaintext);
    string? Unprotect(string? protectedText);
}
