using EntraRoleReaper.Api.Services.Dto;

namespace EntraRoleReaper.Api.Review;

internal class RoleComparer : IEqualityComparer<RoleDefinitionDto>
{
    public bool Equals(RoleDefinitionDto? x, RoleDefinitionDto? y)
    {
        if (ReferenceEquals(x, y)) return true;
        if (x is null) return false;
        if (y is null) return false;
        if (x.GetType() != y.GetType()) return false;
        return x.Id.Equals(y.Id);
    }

    public int GetHashCode(RoleDefinitionDto obj)
    {
        return obj.Id.GetHashCode();
    }
}
