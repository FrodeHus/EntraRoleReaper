using Microsoft.AspNetCore.DataProtection;

namespace EntraRoleReaper.Api.Services;

public class DataProtectionTokenProtector(IDataProtectionProvider provider) : ITokenProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("ReviewJobToken");

    public string? Protect(string? plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return null;
        return _protector.Protect(plaintext);
    }

    public string? Unprotect(string? protectedText)
    {
        if (string.IsNullOrEmpty(protectedText)) return null;
        try { return _protector.Unprotect(protectedText); }
        catch { return null; }
    }
}
