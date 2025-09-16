using System.ComponentModel;
using EntraRoleReaper.Api.Services;
using ModelContextProtocol.Server;

namespace EntraRoleReaper.Api.Modules.Entra.Mcp;

[McpServerToolType]
public static class RoleTools
{
    [McpServerTool, Description("Suggests roles for a given activity")]
    public static string SuggestRolesForActivity(RoleService roleService, [Description("Name of the activity")]string activityName)
    {
        return "Test";
    }
}