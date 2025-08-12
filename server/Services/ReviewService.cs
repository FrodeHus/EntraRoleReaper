using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Graph;
using Microsoft.Graph.Models;

namespace RoleReaper.Services;

public class ReviewService(
    IGraphServiceFactory factory,
    IRoleCache roleCache,
    IOperationMapCache operationMapCache,
    RoleReaper.Data.CacheDbContext db
) : IReviewService
{
    // Operation map now resolved via IOperationMapCache (populated from DB, refreshable after edits)

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

        var userIds = await ExpandUsersOrGroupsAsync(graphClient, request.UsersOrGroups);

        var results = new List<UserReview>();
        await roleCache.InitializeAsync();
        var roles = roleCache.GetAll();
        var actionPrivilege = roleCache.GetActionPrivilegeMap();
        var roleStats = roleCache.GetRolePrivilegeStats();

        foreach (var uid in userIds)
        {
            // Fetch core user + role context
            var userCtx = await GetUserAndRolesAsync(graphClient, uid, roles);
            var display = userCtx.DisplayName;
            var activeRoleIds = userCtx.ActiveRoleIds;
            var eligibleRoleIds = userCtx.EligibleRoleIds;

            // Audit operations + targets
            var auditCtx = await CollectAuditOperationsAsync(request, graphClient, uid);
            var usedOperations = auditCtx.UsedOperations;
            var opTargets = auditCtx.OpTargets;

            // Load exclusions once per review cycle (could be cached, small table)
            var excludedOps = await db
                .OperationExclusions.Select(e => e.OperationName)
                .ToListAsync();
            var excludedSet = new HashSet<string>(excludedOps, StringComparer.OrdinalIgnoreCase);

            // Build operations and permission requirements (excluding)
            var filteredUsedOperations = new HashSet<string>(
                usedOperations.Where(o => !excludedSet.Contains(o)),
                StringComparer.OrdinalIgnoreCase
            );
            var filteredOpTargets = opTargets
                .Where(kvp => !excludedSet.Contains(kvp.Key))
                .ToDictionary(k => k.Key, v => v.Value, StringComparer.OrdinalIgnoreCase);

            var operationsList = await BuildOperationsListAsync(
                graphClient,
                uid,
                filteredUsedOperations,
                filteredOpTargets,
                activeRoleIds,
                roles,
                actionPrivilege
            );
            var requiredPermissionsAll = BuildRequiredPermissions(filteredUsedOperations);

            // Suggest roles
            var suggestionCtx = ComputeSuggestedRoles(requiredPermissionsAll, roles, roleStats);
            var suggested = suggestionCtx.Suggested;
            var suggestedDetails = suggestionCtx.Details;

            // Build operation permission reviews
            var opReviews = BuildOperationReviews(
                operationsList,
                activeRoleIds,
                eligibleRoleIds,
                roles,
                actionPrivilege
            );

            // Compute delta (added / removed)
            var delta = DetermineRoleChanges(
                activeRoleIds,
                eligibleRoleIds,
                suggested,
                suggestedDetails,
                roles
            );

            results.Add(
                new UserReview(
                    new SimpleUser(uid, display),
                    delta.Active,
                    delta.Eligible,
                    opReviews,
                    delta.Added,
                    delta.Removed
                )
            );
        }

        return new ReviewResponse(results);
    }

    // --- Helper methods extracted from ReviewAsync for single responsibilities ---

    private static async Task<HashSet<string>> ExpandUsersOrGroupsAsync(
        GraphServiceClient client,
        IEnumerable<string> usersOrGroups
    )
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in usersOrGroups.Distinct())
        {
            if (id.StartsWith("group:"))
            {
                var groupId = id[6..];
                var members = await client.Groups[groupId].Members.GetAsync();
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

    private async Task<(
        string DisplayName,
        List<string> ActiveRoleIds,
        List<string> EligibleRoleIds,
        HashSet<string> PimActiveRoleIds
    )> GetUserAndRolesAsync(
        GraphServiceClient client,
        string uid,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles
    )
    {
        var user = await client.Users[uid].GetAsync();
        var display = user?.DisplayName ?? user?.UserPrincipalName ?? uid;
        var activeRoleIds = await GetActiveDirectoryRoleIdsAsync(client, uid, roles);
        var (eligibleRoleIds, pimActiveRoleIds) = await GetPIMRoles(client, uid);
        activeRoleIds.AddRange(pimActiveRoleIds);
        activeRoleIds = activeRoleIds.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        return (display, activeRoleIds, eligibleRoleIds, pimActiveRoleIds);
    }

    private static async Task<List<string>> GetActiveDirectoryRoleIdsAsync(
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

    private static async Task<(
        HashSet<string> UsedOperations,
        Dictionary<string, Dictionary<string, ReviewTarget>> OpTargets
    )> CollectAuditOperationsAsync(ReviewRequest request, GraphServiceClient client, string uid)
    {
        var usedOperations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var opTargets = new Dictionary<string, Dictionary<string, ReviewTarget>>(
            StringComparer.OrdinalIgnoreCase
        );
        DirectoryAuditCollectionResponse? audits = await GetAuditEntriesInitiatedBy(
            request,
            client,
            uid
        );
        if (audits?.Value != null)
        {
            foreach (var a in audits.Value)
            {
                if (string.IsNullOrWhiteSpace(a.ActivityDisplayName))
                    continue;
                usedOperations.Add(a.ActivityDisplayName);
                if (a.TargetResources == null || !a.TargetResources.Any())
                    continue;
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
                    if (targetsForOp.ContainsKey(key))
                        continue;
                    // Build modified properties list if present
                    IReadOnlyList<ModifiedProperty>? mods = null;
                    try
                    {
                        var rawMods = tr?.ModifiedProperties;
                        if (rawMods != null && rawMods.Any())
                        {
                            mods = rawMods
                                .Select(mp => new ModifiedProperty(
                                    mp?.DisplayName,
                                    mp?.OldValue?.ToString(),
                                    mp?.NewValue?.ToString()
                                ))
                                .ToList();
                        }
                    }
                    catch { }
                    var upn = tr?.UserPrincipalName;
                    var display = tr?.DisplayName;
                    if (string.IsNullOrWhiteSpace(display) && !string.IsNullOrWhiteSpace(upn))
                        display = upn; // fallback to UPN when display name missing
                    targetsForOp[key] = new ReviewTarget(
                        tr?.Id,
                        display,
                        tr?.Type,
                        FriendlyType(tr?.Type),
                        mods,
                        upn
                    );
                }
            }
        }
        return (usedOperations, opTargets);
    }

    private async Task<List<ReviewOperation>> BuildOperationsListAsync(
        GraphServiceClient client,
        string userId,
        HashSet<string> usedOperations,
        Dictionary<string, Dictionary<string, ReviewTarget>> opTargets,
        List<string> activeRoleIds,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles,
        IReadOnlyDictionary<string, bool> actionPrivilege
    )
    {
        var results = new List<ReviewOperation>();
        // Ownership cache (resourceId -> isOwner)
        var ownershipCache = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        async Task<bool> IsOwnerAsync(ReviewTarget t)
        {
            if (string.IsNullOrWhiteSpace(t.Id))
                return false;
            if (ownershipCache.TryGetValue(t.Id!, out var cached))
                return cached;
            bool owned = false;
            try
            {
                var type = t.Type ?? string.Empty;
                if (type.Equals("application", StringComparison.OrdinalIgnoreCase))
                {
                    var owners = await client
                        .Applications[t.Id]
                        .Owners.GetAsync(q =>
                        {
                            q.QueryParameters.Top = 20;
                        });
                    owned =
                        owners
                            ?.Value?.OfType<DirectoryObject>()
                            .Any(o =>
                                string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase)
                            ) == true;
                }
                else if (type.Equals("serviceprincipal", StringComparison.OrdinalIgnoreCase))
                {
                    var owners = await client
                        .ServicePrincipals[t.Id]
                        .Owners.GetAsync(q =>
                        {
                            q.QueryParameters.Top = 20;
                        });
                    owned =
                        owners
                            ?.Value?.OfType<DirectoryObject>()
                            .Any(o =>
                                string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase)
                            ) == true;
                }
                else if (type.Equals("group", StringComparison.OrdinalIgnoreCase))
                {
                    var owners = await client
                        .Groups[t.Id]
                        .Owners.GetAsync(q =>
                        {
                            q.QueryParameters.Top = 20;
                        });
                    owned =
                        owners
                            ?.Value?.OfType<DirectoryObject>()
                            .Any(o =>
                                string.Equals(o.Id, userId, StringComparison.OrdinalIgnoreCase)
                            ) == true;
                }
            }
            catch
            { /* ignore ownership lookup failures */
            }
            ownershipCache[t.Id!] = owned;
            return owned;
        }

        async Task<bool> ConditionSatisfiedAsync(string condition, List<ReviewTarget> targets)
        {
            if (targets.Count == 0)
                return false; // no context
            if (string.Equals(condition, "$ResourceIsSelf", StringComparison.OrdinalIgnoreCase))
            {
                return targets.Any(t =>
                    !string.IsNullOrWhiteSpace(t.Id)
                    && string.Equals(t.Id, userId, StringComparison.OrdinalIgnoreCase)
                );
            }
            if (string.Equals(condition, "$SubjectIsOwner", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var t in targets)
                {
                    if (!string.IsNullOrWhiteSpace(t.Id) && await IsOwnerAsync(t))
                        return true;
                }
                return false;
            }
            // Unknown condition => treat as not satisfied
            return false;
        }
        // Ensure operation map cache is initialized
        await operationMapCache.InitializeAsync();
        var opMap = operationMapCache.GetAll();
        var propMap = operationMapCache.GetPropertyMap();
        foreach (var op in usedOperations)
        {
            var basePerms = opMap.TryGetValue(op, out var p) ? p : Array.Empty<string>();
            if (propMap.TryGetValue(op, out var perProp))
            {
                var union = new HashSet<string>(basePerms, StringComparer.OrdinalIgnoreCase);
                foreach (var arr in perProp.Values)
                    foreach (var act in arr)
                        union.Add(act);
                basePerms = union.ToArray();
            }
            var perms = basePerms;
            var targets = opTargets.TryGetValue(op, out var allTargets)
                ? allTargets.Values.ToList()
                : new List<ReviewTarget>();

            var currentRoleDefs = activeRoleIds
                .Select(id => roles.TryGetValue(id, out var rd) ? rd : null)
                .Where(rd => rd != null)
                .ToList()!;

            var details = new List<PermissionDetail>();
            foreach (var name in perms)
            {
                var privileged = actionPrivilege.TryGetValue(name, out var isPriv) && isPriv;
                var grantedBy = new List<string>();
                var grantConds = new List<string>(); // aggregate distinct later
                var matchedPerRole = new List<string>(); // aligns with grantedBy (empty string if none)
                foreach (var roleDefinition in currentRoleDefs)
                {
                    if (roleDefinition?.RolePermissions == null)
                        continue;
                    bool allowed = false;
                    string? appliedCond = null;
                    // Prioritize conditional permission sets so that more specific context-sensitive
                    // grants are evaluated before broader ones:
                    // 1. $ResourceIsSelf
                    // 2. $SubjectIsOwner
                    // 3. All others (including null / empty conditions)
                    var orderedRolePerms = roleDefinition.RolePermissions.OrderBy(rp =>
                    {
                        var cond = rp.Condition?.Trim();
                        if (
                            string.Equals(
                                cond,
                                "$ResourceIsSelf",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                            return 0;
                        if (
                            string.Equals(
                                cond,
                                "$SubjectIsOwner",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                            return 1;
                        return 2;
                    });
                    foreach (var rp in orderedRolePerms)
                    {
                        var actions = rp.AllowedResourceActions ?? Enumerable.Empty<string>();
                        if (
                            !actions.Any(a =>
                                string.Equals(a, name, StringComparison.OrdinalIgnoreCase)
                            )
                        )
                            continue;
                        // Evaluate condition if present
                        if (!string.IsNullOrWhiteSpace(rp.Condition))
                        {
                            var cond = rp.Condition.Trim();
                            if (!await ConditionSatisfiedAsync(cond, targets))
                                continue;
                            appliedCond = cond;
                        }
                        allowed = true; // one matching permission set satisfied
                        break;
                    }
                    if (allowed && !string.IsNullOrWhiteSpace(roleDefinition.DisplayName))
                    {
                        grantedBy.Add(roleDefinition.DisplayName!);
                        if (appliedCond != null)
                        {
                            grantConds.Add(appliedCond);
                            matchedPerRole.Add(appliedCond);
                        }
                        else
                        {
                            matchedPerRole.Add(string.Empty);
                        }
                    }
                }
                // Always include the permission detail (even if not currently granted by any active role)
                // so the client can surface "uncovered" mapped actions.
                details.Add(
                    new PermissionDetail(
                        name,
                        privileged,
                        grantedBy, // empty list if not granted
                        grantConds.Count > 0
                            ? grantConds.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                            : null,
                        matchedPerRole.Count > 0 ? matchedPerRole : null
                    )
                );
            }

            var filteredPerms = details
                .Select(d => d.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            results.Add(new ReviewOperation(op, filteredPerms, targets, details));
        }
        return results;
    }

    private HashSet<string> BuildRequiredPermissions(HashSet<string> usedOperations)
    {
        // Operation map cache already initialized earlier in flow when building operations list
        // Use a fresh reference for safety (no await; in-memory)
        var opMap = operationMapCache.GetAll();
        return usedOperations
            .SelectMany(op => opMap.TryGetValue(op, out var p) ? p : [])
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private (string[] Suggested, List<SuggestedRole> Details) ComputeSuggestedRoles(
        HashSet<string> requiredPermissionsAll,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles,
        IReadOnlyDictionary<string, RolePrivilegeStats> roleStats
    )
    {
        string[] suggested;
        List<SuggestedRole> suggestedDetails = new();
        if (requiredPermissionsAll.Count == 0)
            return (Array.Empty<string>(), suggestedDetails);
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
                    (r.RolePermissions ?? []).SelectMany(rp => rp.AllowedResourceActions ?? []),
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
                break;
            chosen.Add((best.Role, best.Stats, best.Allowed));
            foreach (var a in best.Allowed)
                uncovered.Remove(a);
            roleAllowed.RemoveAll(x =>
                string.Equals(x.Role.Id, best.Role.Id, StringComparison.OrdinalIgnoreCase)
            );
        }
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
                    chosen.RemoveAt(i);
            }
        }
        var orderedChosen = chosen
            .OrderBy(c => c.Stats.PrivilegedAllowed)
            .ThenBy(c => c.Stats.TotalAllowed)
            .ThenBy(c => c.Role.DisplayName)
            .ToList();
        suggested = orderedChosen
            .Where(c => !excludes.Contains(c.Role.DisplayName!))
            .Select(c => c.Role.DisplayName!)
            .ToArray();
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
        return (suggested, suggestedDetails);
    }

    private static List<RoleMeta> BuildRoleMeta(
        List<string> activeRoleIds,
        HashSet<string> pimActiveRoleIds,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles
    ) =>
        activeRoleIds
            .Select(id => roles.TryGetValue(id, out var rd) ? rd : null)
            .Where(rd => rd != null && !string.IsNullOrWhiteSpace(rd!.DisplayName))
            .Select(rd => new RoleMeta(
                rd!.DisplayName!,
                pimActiveRoleIds.Contains(rd.Id ?? string.Empty)
            ))
            .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => new RoleMeta(g.Key, g.Any(x => x.Pim)))
            .ToList();

    private static List<OperationReview> BuildOperationReviews(
        List<ReviewOperation> operationsList,
        List<string> activeRoleIds,
        List<string> eligibleRoleIds,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles,
        IReadOnlyDictionary<string, bool> actionPrivilege
    )
    {
        return operationsList
            .Select(op =>
            {
                var distinctTargets = op
                    .Targets.DistinctBy(t => (t.Id ?? "") + "|" + (t.DisplayName ?? ""))
                    .ToList();
                var targets = new List<OperationTarget>(distinctTargets.Count);
                foreach (var t in distinctTargets)
                {
                    List<OperationModifiedProperty>? mods = null;
                    if (t.ModifiedProperties != null)
                    {
                        mods = t
                            .ModifiedProperties.Select(mp => new OperationModifiedProperty(
                                mp.DisplayName,
                                mp.OldValue,
                                mp.NewValue
                            ))
                            .ToList();
                    }
                    targets.Add(new OperationTarget(t.Id, t.DisplayName, mods));
                }
                var currentAndEligible = new HashSet<string>(
                    activeRoleIds.Concat(eligibleRoleIds),
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
                        var isPrivileged = actionPrivilege.TryGetValue(pd.Name, out var ip) && ip;
                        var pdTyped = pd as PermissionDetail;
                        return new OperationPermission(
                            pd.Name,
                            isPrivileged,
                            grantingIds,
                            pdTyped?.GrantConditions,
                            pdTyped?.MatchedConditionsPerRole
                        );
                    })
                    .ToList();
                return new OperationReview(op.Operation, targets, permissions);
            })
            .ToList();
    }

    private static (
        List<SimpleRole> Active,
        List<SimpleRole> Eligible,
        List<SimpleRole> Added,
        List<SimpleRole> Removed
    ) DetermineRoleChanges(
        List<string> activeRoleIds,
        List<string> eligibleRoleIds,
        string[] suggested,
        List<SuggestedRole> suggestedDetails,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles
    )
    {
        var currentSet = new HashSet<string>(activeRoleIds, StringComparer.OrdinalIgnoreCase);
        var suggestedRoleIds = suggestedDetails
            .Where(sr => !string.IsNullOrWhiteSpace(sr.Id))
            .Select(sr => sr.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (suggestedRoleIds.Count == 0)
        {
            var byName = roles
                .Values.Where(r =>
                    !string.IsNullOrWhiteSpace(r.DisplayName) && !string.IsNullOrWhiteSpace(r.Id)
                )
                .ToDictionary(r => r.DisplayName!, r => r.Id!, StringComparer.OrdinalIgnoreCase);
            foreach (var name in suggested)
                if (byName.TryGetValue(name, out var id))
                    suggestedRoleIds.Add(id);
        }
        var suggestedSet = new HashSet<string>(suggestedRoleIds, StringComparer.OrdinalIgnoreCase);
        var added = suggestedRoleIds.Where(id => !currentSet.Contains(id)).ToList();
        var removed =
            suggestedSet.Count > 0
                ? activeRoleIds.Where(id => !suggestedSet.Contains(id)).ToList()
                : new List<string>();
        List<SimpleRole> MapRoles(IEnumerable<string> ids) =>
            ids.Select(id =>
                    roles.TryGetValue(id, out var rdef)
                        ? new SimpleRole(id, rdef?.DisplayName ?? id)
                        : new SimpleRole(id, id)
                )
                .ToList();
        var simpleActive = MapRoles(activeRoleIds.Distinct(StringComparer.OrdinalIgnoreCase));
        var simpleEligible = MapRoles(eligibleRoleIds.Distinct(StringComparer.OrdinalIgnoreCase));
        var simpleAdded = MapRoles(added);
        var simpleRemoved = MapRoles(removed);
        return (simpleActive, simpleEligible, simpleAdded, simpleRemoved);
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
