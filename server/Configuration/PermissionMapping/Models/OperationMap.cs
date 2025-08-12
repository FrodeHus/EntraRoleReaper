namespace EntraRoleReaper.Api.Configuration.PermissionMapping.Models;

public class OperationMap
{
    public required string Operation { get; set; }
    public HashSet<string> ResourceActions { get; set; } = [];
    public List<PropertyMap> Properties { get; set; } = [];
}

public class PropertyMap
{
    public HashSet<string> Properties { get; set; } = [];
    public required string ResourceAction { get; set; }
}
