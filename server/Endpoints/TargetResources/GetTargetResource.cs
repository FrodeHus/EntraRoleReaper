

using EntraRoleReaper.Api.Services;
using EntraRoleReaper.Api.Services.Dto;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace EntraRoleReaper.Api.Endpoints.TargetResources;

public class GetTargetResource : IEndpoint
{
    public static void Map(IEndpointRouteBuilder builder)
    {
        builder.MapGet("/target/{id:guid}", Handle).WithSummary("Retrieves specified target resource").RequireAuthorization();
    }

    private static async Task<Ok<TargetResourceDto>> Handle(Guid id, [FromServices] IActivityService activityService)
    {
        var targetResource = await activityService.GetTargetResource(id);
        var dto = TargetResourceDto.FromTargetResource(targetResource);
        return TypedResults.Ok(dto);
    }
}
