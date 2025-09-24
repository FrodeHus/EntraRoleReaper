using EntraRoleReaper.Api.Data.Models;
using EntraRoleReaper.Api.Review.Models;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using Microsoft.Graph.Models.ODataErrors;
using System.Text.Json;
using EntraRoleReaper.Api.Modules.Entra.Tenants.Models;
using EntraRoleReaper.Api.Services.Dto;
using ModifiedProperty = EntraRoleReaper.Api.Services.Models.ModifiedProperty;

namespace EntraRoleReaper.Api.Modules.Entra.Graph.Common;

public class GraphService(IGraphServiceFactory graphServiceFactory, ILogger<GraphService> logger) : IGraphService
{
    private readonly Dictionary<string, bool> _ownershipCache = [];

    private GraphServiceClient? _client;
    private GraphServiceClient GraphClient
    {
        get
        {
            _client ??= graphServiceFactory.CreateForUserAsync().Result;
            return _client;
        }
    }

    public async Task<HashSet<string>> ExpandUsersOrGroupsAsync(IEnumerable<string> usersOrGroups)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in usersOrGroups.Distinct())
        {
            if (id.StartsWith("group:"))
            {
                var groupId = id[6..];
                var members = await GraphClient.Groups[groupId].Members.GetAsync();
                if (members?.Value == null)
                    continue;
                foreach (var m in members.Value.OfType<User>())
                {
                    if (!string.IsNullOrEmpty(m.Id))
                        set.Add(m.Id);
                }
            }
            else
            {
                set.Add(id.Replace("user:", string.Empty));
            }
        }
        return set;
    }

    public async Task<(
        string DisplayName,
        List<string> ActiveRoleIds,
        List<string> EligibleRoleIds,
        HashSet<string> PimActiveRoleIds
    )> GetUserAndRolesAsync(string uid)
    {
        var user = await GraphClient.Users[uid].GetAsync();
        var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;
        var (eligibleRoleIds, pimActiveRoleIds) = await GetPIMRoles(uid);
        var assignedRoles = await GetRoleAssignmentsAsync(uid);
        if (user?.UserType == "Member")
        {
            var userRole = await GetRoleDefinitionBy("User");
            if (userRole != null)
            {
                assignedRoles.Add(userRole.Id);
            }
        }
        else
        {
            var guestRole = await GetRoleDefinitionBy("Guest");
            if (guestRole != null)
            {
                assignedRoles.Add(guestRole.Id);
            }
        }
        return (display, assignedRoles, eligibleRoleIds, pimActiveRoleIds);
    }

    private async Task<UnifiedRoleDefinition?> GetRoleDefinitionBy(string name)
    {
        var result = await GraphClient.RoleManagement.Directory.RoleDefinitions.GetAsync(q =>
        {
            q.QueryParameters.Filter = $"displayName eq '{name}'";
            q.QueryParameters.Top = 20;
        });
        return result?.Value?.FirstOrDefault();
    }
    public async Task<bool> IsOwnerAsync(string userId, ReviewTargetResource target)
    {
        if (string.IsNullOrWhiteSpace(target.Id))
            return false;
        if (_ownershipCache.TryGetValue(target.Id!, out var cached))
            return cached;
        bool owned = false;
        try
        {
            var type = target.Type ?? string.Empty;
            if (type.Equals("application", StringComparison.OrdinalIgnoreCase))
            {
                var owners = await GraphClient
                    .Applications[target.Id]
                    .Owners.GetAsync(q =>
                    {
                        q.QueryParameters.Top = 20;
                    });
                owned =
                    owners
                        ?.Value?.OfType<DirectoryObject>()
                        .Any(o => string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase))
                    == true;
            }
            else if (type.Equals("serviceprincipal", StringComparison.OrdinalIgnoreCase))
            {
                var owners = await GraphClient
                    .ServicePrincipals[target.Id]
                    .Owners.GetAsync(q =>
                    {
                        q.QueryParameters.Top = 20;
                    });
                owned =
                    owners
                        ?.Value?.OfType<DirectoryObject>()
                        .Any(o => string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase))
                    == true;
            }
            else if (type.Equals("group", StringComparison.OrdinalIgnoreCase))
            {
                var owners = await GraphClient
                    .Groups[target.Id]
                    .Owners.GetAsync(q =>
                    {
                        q.QueryParameters.Top = 20;
                    });
                owned =
                    owners
                        ?.Value?.OfType<DirectoryObject>()
                        .Any(o => string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase))
                    == true;
            }
        }
        catch
        { /* ignore ownership lookup failures */
        }
        _ownershipCache[target.Id!] = owned;
        return owned;
    }

    public async Task<List<AuditActivity>> CollectAuditActivitiesAsync(
        string uid,
        DateTimeOffset from,
        DateTimeOffset to
    )
    {
        string[] validTargetResources = ["User", "Group", "Device", "Application", "Role", "Policy", "Other", "Directory"];
        var auditEntries = new List<AuditActivity>();

        DirectoryAuditCollectionResponse? audits = await GetAuditEntriesInitiatedBy(uid, from, to);
        if (audits?.Value != null)
        {
            foreach (var a in audits.Value)
            {
                if (string.IsNullOrWhiteSpace(a.ActivityDisplayName))
                    continue;

                var auditEntry = new AuditActivity { ActivityName = a.ActivityDisplayName };
                if (a.TargetResources == null || !a.TargetResources.Any())
                    continue;
                var updatedProperties = a
                    .TargetResources
                    .SelectMany(tr => tr.ModifiedProperties ?? [])
                    .FirstOrDefault(t => t.DisplayName == "Included Updated Properties")?
                    .NewValue?.Replace("\"", string.Empty).Replace(" ", string.Empty)
                    .Split(',') ?? [];

                foreach (var tr in a.TargetResources.Where(t => validTargetResources.Contains(t.Type)))
                {
                    var upn = tr?.UserPrincipalName;
                    var display = tr?.DisplayName;
                    if (string.IsNullOrWhiteSpace(display) && !string.IsNullOrWhiteSpace(upn))
                        display = upn;
                    var target = new ReviewTargetResource
                    {
                        Id = tr!.Id ?? "(no id)",
                        Type = tr.Type ?? "(no type)",
                        DisplayName = display ?? "(no name)",
                    };

                    if (tr.ModifiedProperties != null && tr.ModifiedProperties.Count != 0)
                    {
                        target.ModifiedProperties = tr
                            .ModifiedProperties.Where(p => updatedProperties.Contains(p.DisplayName))?.Select(mp => new ModifiedProperty(
                                mp.DisplayName
                            ))
                            .ToList();
                    }
                    auditEntry.TargetResources.Add(target);
                }
                auditEntries.Add(auditEntry);
            }
        }
        var groupedByActivity = auditEntries
            .GroupBy(a => a.ActivityName)
            .Select(df => new AuditActivity
            {
                ActivityName = df.Key,
                TargetResources = [.. df.SelectMany(a => a.TargetResources).DistinctBy(tr => tr.Id).ToList()],
            })
            .ToList();
        return groupedByActivity;
    }

    private async Task<List<string?>> GetRoleAssignmentsAsync(string userId)
    {
        var assignments = await GraphClient.RoleManagement.Directory.RoleAssignments.GetAsync(q =>
        {

            {
                q.QueryParameters.Filter = $"principalId eq '{userId}'";
                q.QueryParameters.Top = 50;
            }
            ;
        });
        return assignments?.Value?.Select(a => a.RoleDefinitionId).ToList() ?? [];
    }
    
    
    private async Task<(
        List<string> eligibleRoleIds,
        HashSet<string> pimActiveRoleIds
    )> GetPIMRoles(string uid)
    {
        var eligibleRoleIds = new List<string>();
        var pimActiveRoleIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var eligibleRoles =
                await GraphClient.RoleManagement.Directory.RoleEligibilityScheduleInstances.GetAsync(
                    q =>
                    {
                        q.QueryParameters.Filter = $"principalId eq '{uid}'";
                        q.QueryParameters.Top = 50;
                    }
                );
            if (eligibleRoles?.Value != null)
            {
                foreach (var e in eligibleRoles.Value)
                {
                    var roleDefId = e.RoleDefinitionId;
                    if (!string.IsNullOrWhiteSpace(roleDefId))
                    {
                        eligibleRoleIds.Add(roleDefId);
                    }
                }
            }

            // Active PIM assignments (current activations)
            var act =
                await GraphClient.RoleManagement.Directory.RoleAssignmentScheduleInstances.GetAsync(
                    q =>
                    {
                        q.QueryParameters.Filter =
                            $"principalId eq '{uid}' and assignmentType eq 'Activated'";
                        q.QueryParameters.Top = 50;
                    }
                );
            if (act?.Value != null)
            {
                foreach (var a in act.Value)
                {
                    var roleDefId = a.RoleDefinitionId;
                    if (!string.IsNullOrWhiteSpace(roleDefId))
                    {
                        pimActiveRoleIds.Add(roleDefId);
                    }
                }
            }
        }
        catch
        {
            // Swallow errors if app lacks PIM read permissions; eligibility is optional metadata
        }

        return (eligibleRoleIds, pimActiveRoleIds);
    }

    public async Task<List<ResourceActionDto>> GetResourceActionMetadataAsync()
    {
        var resourceActionsData = new List<ResourceActionDto>();
        var nsBuilder = GraphClient.RoleManagement.Directory.ResourceNamespaces;
        var nsResponse = await nsBuilder.GetAsync();
        while (nsResponse != null)
        {
            foreach (var ns in nsResponse.Value ?? [])
            {
                if (string.IsNullOrWhiteSpace(ns.Name)) continue;
                var actionsBuilder = GraphClient.RoleManagement.Directory.ResourceNamespaces[ns.Name].ResourceActions;
                var raResponse = await actionsBuilder.GetAsync();
                while (raResponse != null)
                {
                    foreach (var ra in raResponse.Value ?? [])
                    {
                        var name = ra.Name;
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        var isPrivileged = false;
                        if (ra.AdditionalData != null && ra.AdditionalData.TryGetValue("isPrivileged", out var raw))
                        {
                            isPrivileged = raw switch
                            {
                                bool b => b,
                                string s when bool.TryParse(s, out var pb) => pb,
                                JsonElement je => je.ValueKind == JsonValueKind.True,
                                _ => false
                            };
                        }
                        resourceActionsData.Add(new ResourceActionDto
                        {
                            Action = name,
                            Description = ra.Description,
                            ActionVerb = ra.ActionVerb,
                            IsPrivileged = isPrivileged
                        });
                    }
                    if (string.IsNullOrEmpty(raResponse.OdataNextLink)) break;
                    raResponse = await actionsBuilder.WithUrl(raResponse.OdataNextLink).GetAsync();
                }
            }
            if (string.IsNullOrEmpty(nsResponse.OdataNextLink)) break;
            nsResponse = await nsBuilder.WithUrl(nsResponse.OdataNextLink).GetAsync();
        }
        return resourceActionsData;
    }

    private async Task<DirectoryAuditCollectionResponse?> GetAuditEntriesInitiatedBy(
        string uid,
        DateTimeOffset from,
        DateTimeOffset to
    )
    {
        return await GraphClient.AuditLogs.DirectoryAudits.GetAsync(q =>
        {
            q.QueryParameters.Filter =
                $"activityDateTime ge {from:O} and activityDateTime le {to:O} and initiatedBy/user/id eq '{uid}'";
            q.QueryParameters.Top = 250;
        });
    }

    public async Task<List<UnifiedRoleDefinition>?> GetAllRoleDefinitions(
)
    {
        var page = await GraphClient.RoleManagement.Directory.RoleDefinitions.GetAsync();
        return page?.Value;
    }

    public async Task<Tenant?> FetchTenantMetadataAsync(Guid tenantId, CancellationToken ct = default)
    {

        try
        {
            var orgs = await GraphClient.Organization.GetAsync(q =>
            {
                q.QueryParameters.Select = ["id", "displayName", "verifiedDomains"];
            }, ct);
            var org = orgs?.Value?.FirstOrDefault(o => Guid.TryParse(o.Id, out var oid) && oid == tenantId)
                      ?? orgs?.Value?.FirstOrDefault();
            if (org == null)
            {
                logger.LogWarning("Graph returned no organization objects for tenant {TenantId}", tenantId);
                return null;
            }
            return new Tenant
            {
                Id = tenantId,
                Name = org.DisplayName,
                TenantDomain = TryGetPrimaryDomain(org.VerifiedDomains)
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed fetching tenant metadata (non-persistent) for {TenantId}", tenantId);
            return null;
        }
    }
    
    

    public async Task<string?> ActivatePIMRole(string roleId, int durationMinutes = 60)
    {
        var assignments = await GraphClient.RoleManagement.Directory.RoleEligibilitySchedules.GetAsync(q =>
        {
            q.QueryParameters.Filter = $"roleDefinitionId eq '{roleId}'";
            q.QueryParameters.Top = 20;
        });
        var assignment = assignments?.Value?.FirstOrDefault();
        if (assignment == null)
            throw new InvalidOperationException($"No eligible assignment found for role {roleId}");

        var activation = new UnifiedRoleAssignmentScheduleRequest
        {
            Action = UnifiedRoleScheduleRequestActions.SelfActivate,
            RoleDefinitionId = roleId,
            ScheduleInfo = new RequestSchedule
            {
                Expiration = new ExpirationPattern
                {
                    Type = ExpirationPatternType.AfterDateTime,
                    EndDateTime = DateTimeOffset.UtcNow.AddMinutes(durationMinutes)
                }
            },
            Justification = "Activated via Entra Role Reaper for review processing",
            PrincipalId = assignment.PrincipalId,
            DirectoryScopeId = assignment.DirectoryScopeId,
        };
        try
        {
            var result =
                await GraphClient.RoleManagement.Directory.RoleAssignmentScheduleRequests.PostAsync(activation);
            if (result == null || string.IsNullOrWhiteSpace(result.Id))
                throw new InvalidOperationException($"Failed to activate role {roleId}");
            return result.Status;
        }
        catch (ODataError ex)
        {
            logger.LogError(ex, "Failed to activate role {RoleId}", roleId);
            return ex.Error?.Message;
        }
    }

    public async Task<string?> CreateCustomRole(string roleName, string description, List<string> permissions)
    {
        var definition = new UnifiedRoleDefinition
        {
            DisplayName = roleName,
            Description = description,
            IsEnabled = true,
            RolePermissions = [
                    new UnifiedRolePermission
                    {
                        AllowedResourceActions = permissions
                    }
                ]
        }
        ;
        var result = await GraphClient.RoleManagement.Directory.RoleDefinitions.PostAsync(definition);
        return result?.Id ?? null;
    }

    private static string? TryGetPrimaryDomain(List<VerifiedDomain>? domains)
    {
        if (domains == null || domains.Count == 0) return null;
        return domains.FirstOrDefault(d => d.IsDefault == true)?.Name
               ?? domains.FirstOrDefault(d => d.IsInitial == true)?.Name
               ?? domains.FirstOrDefault()?.Name;
    }
}
