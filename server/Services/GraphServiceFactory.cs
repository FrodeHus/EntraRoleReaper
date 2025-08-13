using Azure.Identity;
using EntraRoleReaper.Api.Services.Interfaces;
using Microsoft.Graph;

namespace EntraRoleReaper.Api.Services;

public class GraphServiceFactory(IConfiguration config, IHttpContextAccessor accessor)
    : IGraphServiceFactory
{
    public async Task<GraphServiceClient> CreateForUserAsync()
    {
        var tenantId =
            config["AzureAd:TenantId"]
            ?? throw new InvalidOperationException("Missing AzureAd:TenantId");
        var clientId =
            config["AzureAd:ClientId"]
            ?? throw new InvalidOperationException("Missing AzureAd:ClientId");
        var clientSecret =
            config["AzureAd:ClientSecret"]
            ?? throw new InvalidOperationException("Missing AzureAd:ClientSecret");

        var token = accessor
            .HttpContext?.Request.Headers.Authorization.ToString()
            ?.Replace("Bearer ", "");
        if (string.IsNullOrEmpty(token))
            throw new UnauthorizedAccessException("Authorization token is missing.");

        var cred = new OnBehalfOfCredential(tenantId, clientId, clientSecret, token);
        var client = new GraphServiceClient(
            cred,
            ["https://graph.microsoft.com/.default"],
            "https://graph.microsoft.com/beta"
        );
        return await Task.FromResult(client);
    }
}
