using System.Reflection.Metadata;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.Search;

public class GetSearch : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/api/search", Handle)
            .WithSummary("Searches for roles and actions based on a query string")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .RequireAuthorization();
    }

    private static async Task<Ok<IEnumerable<DirectoryItem>>> Handle(string q, bool includeGroups,[FromServices] IUserSearchService svc)
    {
        {
            var results = await svc.SearchAsync(q, includeGroups);
            return TypedResults.Ok(results);
        }
    }
}