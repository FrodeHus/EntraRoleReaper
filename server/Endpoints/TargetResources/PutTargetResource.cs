

using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.TargetResources;

public class PutTargetResource : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapPut("/target/{id:guid}", Handle).WithSummary("Updates a target resource").RequireAuthorization();
    }

    private static async Task<Ok> Handle(Guid id, [FromBody] PutTargetResourceRequest request, [FromServices] IActivityService activityService)
    {
        var targetResource = await activityService.GetTargetResource(id);
        if (targetResource == null)
        {
            return TypedResults.Ok();
        }

        foreach (var property in request.TargetResource.Properties.Where(t => targetResource.Properties.Any(p => p.DisplayName?.Equals(
            t.PropertyName,
            StringComparison.InvariantCultureIgnoreCase) ?? false)))
        {
            targetResource.Properties.Add(new TargetResourceProperty
            {
                PropertyName = property.PropertyName,
                IsSensitive = property.IsSensitive
            });
        }

        await activityService.UpdateTargetResourceAsync(targetResource);
        return TypedResults.Ok();
    }

    private record PutTargetResourceRequest(TargetResourceDto TargetResource);
}
