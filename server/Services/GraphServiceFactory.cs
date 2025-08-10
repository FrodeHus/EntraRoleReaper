using Azure.Identity;
using Microsoft.Graph;
using Microsoft.Identity.Client;

namespace EntraRoleAuditor.Services;

public interface IGraphServiceFactory
{
    Task<GraphServiceClient> CreateForUserAsync(string bearerToken);
}

public class GraphServiceFactory(IConfiguration config) : IGraphServiceFactory
{
    public async Task<GraphServiceClient> CreateForUserAsync(string bearerToken)
    {
    var tenantId = config["AzureAd:TenantId"] ?? throw new InvalidOperationException("Missing AzureAd:TenantId");
    var clientId = config["AzureAd:ClientId"] ?? throw new InvalidOperationException("Missing AzureAd:ClientId");
    var clientSecret = config["AzureAd:ClientSecret"] ?? throw new InvalidOperationException("Missing AzureAd:ClientSecret");

    var cred = new OnBehalfOfCredential(tenantId, clientId, clientSecret, bearerToken);
    var client = new GraphServiceClient(cred, new[] { "https://graph.microsoft.com/.default" });
    return await Task.FromResult(client);
    }
}
