using EntraRoleReaper.Api.Services.Models;

namespace EntraRoleReaper.Api.Services.Models;

public enum ReviewJobStatus
{
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled
}