namespace EntraRoleReaper.Api.Services.Dto;

public record TenantMetadataDto(Guid Id, string Name, string Domain, int CustomRoleCount);