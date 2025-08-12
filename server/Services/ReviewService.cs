using System.Globalization;
using System.Text.Json;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace RoleReaper.Services;

public class ReviewService(IGraphServiceFactory factory, IRoleCache roleCache) : IReviewService
{
    private readonly Lazy<Dictionary<string, string[]>> _permissionMap = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Configuration", "permissions-map.json");
        if (File.Exists(path))
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<Dictionary<string, string[]>>(json) ?? [];
        }
        return [];
    });

    private readonly Lazy<HashSet<string>> _suggestionExcludes = new(() =>
    {
        try
        {
            var path = Path.Combine(
                AppContext.BaseDirectory,
                "Configuration",
                "suggested-role-exclude.json"
            );
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var arr = JsonSerializer.Deserialize<string[]>(json) ?? [];
                return new HashSet<string>(arr, StringComparer.OrdinalIgnoreCase);
            }
        }
        catch
        {
            // ignore, fallback to empty set
        }
        return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    });

    public async Task<ReviewResponse> ReviewAsync(ReviewRequest request)
    {
        var graphClient = await factory.CreateForUserAsync();

        // Expand groups to users
        var userIds = new HashSet<string>();
        foreach (var id in request.UsersOrGroups.Distinct())
        {
            if (id.StartsWith("group:"))
            {
                var groupId = id[6..];
                var members = await graphClient.Groups[groupId].Members.GetAsync();
                if (members?.Value != null)
                {
                    foreach (var m in members.Value.OfType<User>())
                    {
                        if (!string.IsNullOrEmpty(m.Id))
                            userIds.Add(m.Id);
                    }
                }
            }
            else
            {
                userIds.Add(id.Replace("user:", string.Empty));
            }
        }

        var results = new List<UserReview>();
        await roleCache.InitializeAsync();
        var roles = roleCache.GetAll();
        var actionPrivilege = roleCache.GetActionPrivilegeMap();
        var roleStats = roleCache.GetRolePrivilegeStats();

        foreach (var uid in userIds)
        {
            var user = await graphClient.Users[uid].GetAsync();
            var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;

            // Get current directory roles for the user via memberOf (DirectoryRole)
            var currentRoleIds = new List<string>();
            var memberships = await graphClient.Users[uid].MemberOf.GetAsync();
            if (memberships?.Value != null)
            {
                foreach (var mo in memberships.Value.OfType<DirectoryRole>())
                {
                    var templateId = mo.RoleTemplateId;
                    if (!string.IsNullOrEmpty(templateId))
                    {
                        // Map templateId to unified role definition id
                        var match = roles.Values.FirstOrDefault(r =>
                            string.Equals(
                                r.TemplateId,
                                templateId,
                                StringComparison.OrdinalIgnoreCase
                            )
                        );
                        if (match?.Id != null)
                            currentRoleIds.Add(match.Id);
                    }
                }
            }

            // Include eligible PIM roles (do not use these to grant permissions, just report)
            (List<string> eligibleRoleIds, HashSet<string> pimActiveRoleIds) = await GetPIMRoles(
                graphClient,
                uid
            );

            currentRoleIds.AddRange(pimActiveRoleIds);
            currentRoleIds.AddRange(eligibleRoleIds);

            // Audit logs: directory audits filtered by user and time
            var usedOperations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            // Collect per-operation target details (unique by type+id)
            var opTargets = new Dictionary<string, Dictionary<string, ReviewTarget>>(
                StringComparer.OrdinalIgnoreCase
            );
            DirectoryAuditCollectionResponse? audits = await GetAuditEntriesInitiatedBy(
                request,
                graphClient,
                uid
            );
            if (audits?.Value != null)
            {
                foreach (var a in audits.Value)
                {
                    if (!string.IsNullOrWhiteSpace(a.ActivityDisplayName))
                    {
                        usedOperations.Add(a.ActivityDisplayName);

                        // Capture target resources per operation
                        if (a.TargetResources != null && a.TargetResources.Any())
                        {
                            if (!opTargets.TryGetValue(a.ActivityDisplayName, out var targetsForOp))
                            {
                                targetsForOp = new Dictionary<string, ReviewTarget>(
                                    StringComparer.OrdinalIgnoreCase
                                );
                                opTargets[a.ActivityDisplayName] = targetsForOp;
                            }

                            foreach (var tr in a.TargetResources)
                            {
                                var key =
                                    $"{tr?.Type ?? ""}:{tr?.Id ?? tr?.DisplayName ?? Guid.NewGuid().ToString()}";
                                if (!targetsForOp.ContainsKey(key))
                                {
                                    targetsForOp[key] = new ReviewTarget(
                                        tr?.Id,
                                        tr?.DisplayName,
                                        tr?.Type,
                                        FriendlyType(tr?.Type)
                                    );
                                }
                            }
                        }
                    }
                }
            }

            // Map operations to required permissions via static map (extendable)
            var operationsList = usedOperations
                .Select(op =>
                {
                    var perms = _permissionMap.Value.TryGetValue(op, out var permissions)
                        ? permissions
                        : [];
                    var targets = opTargets.TryGetValue(op, out var allTargets)
                        ? [.. allTargets.Values]
                        : new List<ReviewTarget>();

                    // For each permission, determine which of the user's current roles grants it
                    var currentRoleDefs = currentRoleIds
                        .Select(id => roles.TryGetValue(id, out var rd) ? rd : null)
                        .Where(rd => rd != null)
                        .ToList()!;

                    var details = perms
                        .Select(name =>
                        {
                            var privileged =
                                actionPrivilege.TryGetValue(name, out var isPriv) && isPriv;
                            var grantedBy = new List<string>();
                            foreach (var roleDefinition in currentRoleDefs)
                            {
                                var allows =
                                    roleDefinition!.RolePermissions?.Any(rolePermission =>
                                        (rolePermission.AllowedResourceActions ?? []).Any(
                                            resourceAction =>
                                                string.Equals(
                                                    resourceAction,
                                                    name,
                                                    StringComparison.OrdinalIgnoreCase
                                                )
                                        )
                                    ) ?? false;
                                if (
                                    allows && !string.IsNullOrWhiteSpace(roleDefinition.DisplayName)
                                )
                                {
                                    grantedBy.Add(roleDefinition.DisplayName!);
                                }
                            }
                            return new PermissionDetail(name, privileged, grantedBy);
                        })
                        .ToList();

                    // Only report permissions actually granted by the user's current roles
                    var filteredDetails = details
                        .Where(d => d.GrantedByRoles != null && d.GrantedByRoles.Count > 0)
                        .ToList();
                    var filteredPerms = filteredDetails
                        .Select(d => d.Name)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray();

                    return new ReviewOperation(op, filteredPerms, targets, filteredDetails);
                })
                .ToList();

            // Build the full set of permissions needed from operation names (unfiltered by current roles)
            var requiredPermissionsAll = usedOperations
                .SelectMany(op => _permissionMap.Value.TryGetValue(op, out var p) ? p : [])
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // Suggest a minimal set of roles that covers the required permissions, preferring least-privileged
            string[] suggested;
            List<SuggestedRole> suggestedDetails = new();
            if (requiredPermissionsAll.Count == 0)
            {
                suggested = [];
            }
            else
            {
                // Precompute role -> allowed actions set
                var excludes = _suggestionExcludes.Value;
                var roleAllowed = roles
                    .Values.Where(r =>
                        r.RolePermissions != null
                        && r.RolePermissions.Count != 0
                        && !string.IsNullOrWhiteSpace(r.DisplayName)
                        && !excludes.Contains(r.DisplayName!)
                    )
                    .Select(r => new
                    {
                        Role = r,
                        Allowed = new HashSet<string>(
                            (r.RolePermissions ?? []).SelectMany(rp =>
                                rp.AllowedResourceActions ?? []
                            ),
                            StringComparer.OrdinalIgnoreCase
                        ),
                        Stats = (r.Id != null && roleStats.TryGetValue(r.Id!, out var rs))
                            ? rs
                            : new RolePrivilegeStats(
                                PrivilegedAllowed: 0,
                                TotalAllowed: (r.RolePermissions ?? []).Sum(rp =>
                                    (rp.AllowedResourceActions ?? []).Count
                                )
                            ),
                    })
                    .ToList();

                var uncovered = new HashSet<string>(
                    requiredPermissionsAll,
                    StringComparer.OrdinalIgnoreCase
                );
                var chosen =
                    new List<(
                        UnifiedRoleDefinition Role,
                        RolePrivilegeStats Stats,
                        HashSet<string> Allowed
                    )>();

                // Greedy set cover: pick the role that covers the most uncovered perms; tiebreak by least privileged and size
                while (uncovered.Count > 0)
                {
                    var best = roleAllowed
                        .Select(x => new
                        {
                            x.Role,
                            x.Allowed,
                            x.Stats,
                            CoverCount = x.Allowed.Count(a => uncovered.Contains(a)),
                        })
                        .Where(x => x.CoverCount > 0)
                        .OrderByDescending(x => x.CoverCount)
                        .ThenBy(x => x.Stats.PrivilegedAllowed)
                        .ThenBy(x => x.Stats.TotalAllowed)
                        .ThenBy(x => x.Role.DisplayName)
                        .FirstOrDefault();

                    if (best == null)
                    {
                        // Can't cover remaining perms; break to avoid infinite loop
                        break;
                    }

                    chosen.Add((best.Role, best.Stats, best.Allowed));
                    // Remove covered perms
                    foreach (var a in best.Allowed)
                    {
                        uncovered.Remove(a);
                    }
                    // Remove chosen from candidates
                    roleAllowed.RemoveAll(x =>
                        string.Equals(x.Role.Id, best.Role.Id, StringComparison.OrdinalIgnoreCase)
                    );
                }

                // Redundancy cleanup: drop any role that isn't needed for coverage
                if (chosen.Count > 1)
                {
                    var required = new HashSet<string>(
                        requiredPermissionsAll,
                        StringComparer.OrdinalIgnoreCase
                    );
                    for (int i = chosen.Count - 1; i >= 0; i--)
                    {
                        var without = chosen
                            .Where((_, idx) => idx != i)
                            .SelectMany(c => c.Allowed)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);
                        if (required.All(p => without.Contains(p)))
                        {
                            chosen.RemoveAt(i);
                        }
                    }
                }

                // Order the final selection by least privileged then size
                var orderedChosen = chosen
                    .OrderBy(c => c.Stats.PrivilegedAllowed)
                    .ThenBy(c => c.Stats.TotalAllowed)
                    .ThenBy(c => c.Role.DisplayName)
                    .ToList();

                suggested = orderedChosen
                    .Where(c => !excludes.Contains(c.Role.DisplayName!))
                    .Select(c => c.Role.DisplayName!)
                    .ToArray();

                // Build detailed reasons per suggested role
                foreach (var (Role, Stats, Allowed) in orderedChosen)
                {
                    if (excludes.Contains(Role.DisplayName!))
                        continue;
                    int covered = Allowed.Count(a => requiredPermissionsAll.Contains(a));
                    suggestedDetails.Add(
                        new SuggestedRole(
                            Role.Id ?? string.Empty,
                            Role.DisplayName!,
                            covered,
                            Stats.PrivilegedAllowed,
                            Stats.TotalAllowed
                        )
                    );
                }
            }

            // Build role metadata for UI labels (PIM badge on active PIM roles)
            var roleMeta = currentRoleIds
                .Select(id => roles.TryGetValue(id, out var rd) ? rd : null)
                .Where(rd => rd != null && !string.IsNullOrWhiteSpace(rd!.DisplayName))
                .Select(rd => new RoleMeta(
                    rd!.DisplayName!,
                    pimActiveRoleIds.Contains(rd.Id ?? string.Empty)
                ))
                .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .Select(g => new RoleMeta(g.Key, g.Any(x => x.Pim)))
                .ToList();

            // Build operation reviews for new contract
            var opReviews = operationsList
                .Select(op =>
                {
                    var targets = op
                        .Targets.DistinctBy(t => (t.Id ?? "") + "|" + (t.DisplayName ?? ""))
                        .Select(t => new OperationTarget(t.Id, t.DisplayName))
                        .ToList();
                    // For each permission detail we now map to role IDs (active + eligible) that grant it
                    var currentAndEligible = new HashSet<string>(
                        currentRoleIds.Concat(eligibleRoleIds),
                        StringComparer.OrdinalIgnoreCase
                    );
                    var nameToId = roles
                        .Values.Where(r =>
                            !string.IsNullOrWhiteSpace(r.DisplayName)
                            && !string.IsNullOrWhiteSpace(r.Id)
                        )
                        .GroupBy(r => r.DisplayName!, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(
                            g => g.Key,
                            g => g.Select(r => r.Id!).First(),
                            StringComparer.OrdinalIgnoreCase
                        );
                    var permissions = op
                        .PermissionDetails.Select(pd =>
                        {
                            var grantingIds =
                                pd.GrantedByRoles.Select(n =>
                                        nameToId.TryGetValue(n, out var id) ? id : null
                                    )
                                    .Where(id => id != null && currentAndEligible.Contains(id))
                                    .Distinct()!
                                    .ToList() as IReadOnlyList<string>;
                            return new OperationPermission(pd.Name, grantingIds);
                        })
                        .ToList();
                    return new OperationReview(op.Operation, targets, permissions);
                })
                .ToList();

            // Determine added / removed roles (suggested vs current) using IDs where possible
            var currentSet = new HashSet<string>(currentRoleIds, StringComparer.OrdinalIgnoreCase);
            var suggestedRoleIds = suggestedDetails
                .Where(sr => !string.IsNullOrWhiteSpace(sr.Id))
                .Select(sr => sr.Id)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            // If we had no detailed ids (edge case), try map display names
            if (suggestedRoleIds.Count == 0)
            {
                var byName = roles
                    .Values.Where(r =>
                        !string.IsNullOrWhiteSpace(r.DisplayName)
                        && !string.IsNullOrWhiteSpace(r.Id)
                    )
                    .ToDictionary(
                        r => r.DisplayName!,
                        r => r.Id!,
                        StringComparer.OrdinalIgnoreCase
                    );
                foreach (var name in suggested)
                {
                    if (byName.TryGetValue(name, out var id))
                        suggestedRoleIds.Add(id);
                }
            }
            var suggestedSet = new HashSet<string>(
                suggestedRoleIds,
                StringComparer.OrdinalIgnoreCase
            );
            var added = suggestedRoleIds.Where(id => !currentSet.Contains(id)).ToList();
            var removed =
                suggestedSet.Count > 0
                    ? currentRoleIds.Where(id => !suggestedSet.Contains(id)).ToList()
                    : new List<string>();
            var simpleAdded = added
                .Select(id =>
                    roles.TryGetValue(id, out var rdef)
                        ? new SimpleRole(id, rdef?.DisplayName ?? id)
                        : new SimpleRole(id, id)
                )
                .ToList();
            var simpleRemoved = removed
                .Select(id =>
                    roles.TryGetValue(id, out var rdef)
                        ? new SimpleRole(id, rdef?.DisplayName ?? id)
                        : new SimpleRole(id, id)
                )
                .ToList();

            var distinctCurrent = currentRoleIds
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var simpleActive = distinctCurrent
                .Select(id =>
                    roles.TryGetValue(id, out var rdef)
                        ? new SimpleRole(id, rdef?.DisplayName ?? id)
                        : new SimpleRole(id, id)
                )
                .ToList();
            var distinctEligible = eligibleRoleIds
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var simpleEligible = distinctEligible
                .Select(id =>
                    roles.TryGetValue(id, out var rdef)
                        ? new SimpleRole(id, rdef?.DisplayName ?? id)
                        : new SimpleRole(id, id)
                )
                .ToList();

            results.Add(
                new UserReview(
                    new SimpleUser(uid, display),
                    simpleActive,
                    simpleEligible,
                    opReviews,
                    simpleAdded,
                    simpleRemoved
                )
            );
        }

        return new ReviewResponse(results);
    }

    private static async Task<DirectoryAuditCollectionResponse?> GetAuditEntriesInitiatedBy(
        ReviewRequest request,
        GraphServiceClient graphClient,
        string uid
    )
    {
        return await graphClient.AuditLogs.DirectoryAudits.GetAsync(q =>
        {
            q.QueryParameters.Filter =
                $"activityDateTime ge {request.From:O} and activityDateTime le {request.To:O} and initiatedBy/user/id eq '{uid}'";
            q.QueryParameters.Top = 100;
        });
    }

    private static async Task<(
        List<string> eligibleRoleIds,
        HashSet<string> pimActiveRoleIds
    )> GetPIMRoles(GraphServiceClient graphClient, string uid)
    {
        var eligibleRoleIds = new List<string>();
        var pimActiveRoleIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var elig =
                await graphClient.RoleManagement.Directory.RoleEligibilityScheduleInstances.GetAsync(
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
                await graphClient.RoleManagement.Directory.RoleAssignmentScheduleInstances.GetAsync(
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

    private static string? FriendlyType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type))
            return null;
        var t = type.Trim();
        switch (t.ToLowerInvariant())
        {
            case "user":
                return "User";
            case "group":
                return "Group";
            case "directoryrole":
                return "Directory role";
            case "roledefinition":
                return "Role definition";
            case "serviceprincipal":
                return "App (service principal)";
            case "application":
                return "App (application)";
            case "device":
                return "Device";
            case "policy":
                return "Policy";
            case "approleassignment":
                return "App role assignment";
            case "oauth2permissiongrant":
                return "OAuth permission grant";
            case "directorysetting":
                return "Directory setting";
            default:
                // Title-case the original type as a fallback
                return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(t);
        }
    }
}
