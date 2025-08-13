using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace RoleReaper.Services;

public class GraphService(IGraphServiceFactory graphServiceFactory)
{
    public Dictionary<string, bool> _ownershipCache = [];

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
    )> GetUserAndRolesAsync(string uid, IReadOnlyDictionary<string, UnifiedRoleDefinition> roles)
    {
        var user = await GraphClient.Users[uid].GetAsync();
        var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;
        var activeRoleIds = await GetActiveDirectoryRoleIdsAsync(GraphClient, uid, roles);
        var (eligibleRoleIds, pimActiveRoleIds) = await GetPIMRoles(uid);
        activeRoleIds.AddRange(pimActiveRoleIds);
        activeRoleIds = activeRoleIds.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        return (display, activeRoleIds, eligibleRoleIds, pimActiveRoleIds);
    }

    public static async Task<List<string>> GetActiveDirectoryRoleIdsAsync(
        GraphServiceClient client,
        string uid,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles
    )
    {
        var list = new List<string>();
        var memberships = await client.Users[uid].MemberOf.GetAsync();
        if (memberships?.Value == null)
            return list;
        foreach (var mo in memberships.Value.OfType<DirectoryRole>())
        {
            var templateId = mo.RoleTemplateId;
            if (string.IsNullOrEmpty(templateId))
                continue;
            // Some Graph responses (v1) may not populate UnifiedRoleDefinition.TemplateId; fall back to Id comparison.
            var match = roles.Values.FirstOrDefault(r =>
                string.Equals(r.TemplateId, templateId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Id, templateId, StringComparison.OrdinalIgnoreCase)
            );
            if (match?.Id != null)
                list.Add(match.Id);
        }
        return list;
    }

    public async Task<bool> IsOwnerAsync(string userId, AuditTargetResource target)
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

    public async Task<List<AuditActivity>> CollectAuditOperationsAsync(
        ReviewRequest request,
        string uid
    )
    {
        var auditEntries = new List<AuditActivity>();

        DirectoryAuditCollectionResponse? audits = await GetAuditEntriesInitiatedBy(request, uid);
        if (audits?.Value != null)
        {
            foreach (var a in audits.Value)
            {
                if (string.IsNullOrWhiteSpace(a.ActivityDisplayName))
                    continue;

                var auditEntry = new AuditActivity { ActivityName = a.ActivityDisplayName };
                if (a.TargetResources == null || !a.TargetResources.Any())
                    continue;

                foreach (var tr in a.TargetResources)
                {
                    if (tr is null)
                    {
                        continue;
                    }
                    var upn = tr?.UserPrincipalName;
                    var display = tr?.DisplayName;
                    if (string.IsNullOrWhiteSpace(display) && !string.IsNullOrWhiteSpace(upn))
                        display = upn;
                    var target = new AuditTargetResource
                    {
                        Id = tr!.Id ?? "(no id)",
                        Type = tr.Type ?? "(no type)",
                        DisplayName = display ?? "(no name)",
                    };

                    if (tr.ModifiedProperties != null && tr.ModifiedProperties.Any())
                    {
                        target.ModifiedProperties = tr
                            .ModifiedProperties.Select(mp => new ModifiedProperty(
                                mp.DisplayName,
                                mp.OldValue,
                                mp.NewValue
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
                TargetResources = [.. df.SelectMany(a => a.TargetResources)],
            })
            .ToList();
        return groupedByActivity;
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
            var elig =
                await GraphClient.RoleManagement.Directory.RoleEligibilityScheduleInstances.GetAsync(
                    q =>
                    {
                        q.QueryParameters.Filter = $"principalId eq '{uid}'";
                        q.QueryParameters.Top = 50;
                    }
                );
            if (elig?.Value != null)
            {
                foreach (var e in elig.Value)
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

    private async Task<DirectoryAuditCollectionResponse?> GetAuditEntriesInitiatedBy(
        ReviewRequest request,
        string uid
    )
    {
        return await GraphClient.AuditLogs.DirectoryAudits.GetAsync(q =>
        {
            q.QueryParameters.Filter =
                $"activityDateTime ge {request.From:O} and activityDateTime le {request.To:O} and initiatedBy/user/id eq '{uid}'";
            q.QueryParameters.Top = 100;
        });
    }
}
