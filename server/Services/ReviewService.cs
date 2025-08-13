using System.Globalization;
using System.Text.Json;
using EntraRoleReaper.Api.Data;
using EntraRoleReaper.Api.Services.Interfaces;
using EntraRoleReaper.Api.Services.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Graph.Models;

namespace EntraRoleReaper.Api.Services;

public class ReviewService(
    GraphService graphService,
    IRoleCache roleCache,
    IOperationMapCache operationMapCache,
    CacheDbContext db
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
        var userIds = await graphService.ExpandUsersOrGroupsAsync(request.UsersOrGroups);

        var results = new List<UserReview>();
        await roleCache.InitializeAsync();
        var roles = roleCache.GetAll();
        var actionPrivilege = roleCache.GetActionPrivilegeMap();
        var roleStats = roleCache.GetRolePrivilegeStats();

        foreach (var uid in userIds)
        {
            // Fetch core user + role context
            var userCtx = await graphService.GetUserAndRolesAsync(uid);
            var display = userCtx.DisplayName;
            var activeRoleIds = userCtx.ActiveRoleIds;
            var eligibleRoleIds = userCtx.EligibleRoleIds;

            // Audit operations + targets
            var auditActivities = await graphService.CollectAuditActivitiesAsync(request, uid);

            // Load exclusions once per review cycle (could be cached, small table)
            var excludedOps = await db
                .OperationExclusions.Select(e => e.OperationName)
                .ToListAsync();
            var excludedSet = new HashSet<string>(excludedOps, StringComparer.OrdinalIgnoreCase);

            // Build operations and permission requirements (excluding)
            var filteredAuditActivities = new List<AuditActivity>(
                auditActivities.Where(o => !excludedSet.Contains(o.ActivityName))
            );
            var userRoles = activeRoleIds;
            userRoles.AddRange(eligibleRoleIds);
            
            var operationsList = await BuildOperationsListAsync(
                uid,
                filteredAuditActivities,
                userRoles,
                roles,
                actionPrivilege
            );
            var requiredPermissionsAll = BuildRequiredPermissions(filteredAuditActivities);

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

    private async Task<List<ReviewOperation>> BuildOperationsListAsync(
        string userId,
        List<AuditActivity> auditActivities,
        List<string> activeRoleIds,
        IReadOnlyDictionary<string, UnifiedRoleDefinition> roles,
        IReadOnlyDictionary<string, bool> actionPrivilege
    )
    {
        var results = new List<ReviewOperation>();
        
        // Ensure operation map cache is initialized
        await operationMapCache.InitializeAsync();
        var operationResourceActions = operationMapCache.GetAll();
        foreach (var auditActivity in auditActivities)
        {
            var toplevelResourceActions = operationResourceActions.TryGetValue(auditActivity.ActivityName, out var resourceActions)
                ? resourceActions
                : [];
            

            var userRoles = activeRoleIds
                .Select(id => roles.TryGetValue(id, out var rd) ? rd : null)
                .Where(rd => rd != null)
                .ToList();

            
            var details = new List<PermissionDetail>();
            foreach (var resourceAction in toplevelResourceActions)
            {
                var privileged = actionPrivilege.TryGetValue(resourceAction, out var isPrivileged) && isPrivileged;
                foreach (var roleDefinition in userRoles)
                {
                    if (roleDefinition?.RolePermissions == null)
                        continue;
                    // Prioritize conditional permission sets so that more specific context-sensitive
                    // grants are evaluated before broader ones:
                    // 1. $ResourceIsSelf
                    // 2. $SubjectIsOwner
                    // 3. All others (including null / empty conditions)

                    var permissionsOnSelf =
                        roleDefinition.GetUnifiedRolePermissionBy(PermissionCondition.ResourceIsSelf);
                    if (permissionsOnSelf != null)
                    {
                        foreach(var targetResource in auditActivity.TargetResources)
                        {
                            if (userId == targetResource.Id && permissionsOnSelf.HasResourceAction(resourceAction))
                            {
                                details.Add(
                                    new PermissionDetail(
                                        resourceAction,
                                        privileged,
                                        [roleDefinition.DisplayName!],
                                        ["$ResourceIsSelf"],
                                        null
                                    )
                                );
                            }
                        }
                    }
                    
                    var permissionsOnOwner =
                        roleDefinition.GetUnifiedRolePermissionBy(PermissionCondition.SubjectIsOwner);

                    if (permissionsOnOwner != null)
                    {
                        foreach (var targetResource in auditActivity.TargetResources)
                        {
                            var isOwner = await graphService.IsOwnerAsync(userId, targetResource);
                            if (isOwner && permissionsOnOwner.HasResourceAction(resourceAction))
                            {
                                details.Add(
                                    new PermissionDetail(
                                        resourceAction,
                                        privileged,
                                        [roleDefinition.DisplayName!],
                                        ["$SubjectIsOwner"],
                                        null
                                    )
                                );
                            }
                        }
                    }
                    
                    var permissionsTenantWide =
                        roleDefinition.GetUnifiedRolePermissionBy(PermissionCondition.None);
                    if (permissionsTenantWide != null && permissionsTenantWide.HasResourceAction(resourceAction))
                    {
                        details.Add(
                            new PermissionDetail(
                                resourceAction,
                                privileged,
                                [roleDefinition.DisplayName!],
                                ["(no condition)"],
                                null
                            )
                        );
                    }
                }
            }

            var filteredPerms = details
                .Select(d => d.Name)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            var reviewedTargets = auditActivity
                .TargetResources.Select(tr => new ReviewTarget(
                    tr.Id,
                    tr.DisplayName,
                    tr.Type,
                    "(no label)",
                    tr.ModifiedProperties,
                    "(no upn)"
                ))
                .ToList();
            results.Add(
                new ReviewOperation(auditActivity.ActivityName, filteredPerms, reviewedTargets, details)
            );
        }
        return results;
    }

    private HashSet<string> BuildRequiredPermissions(List<AuditActivity> usedOperations)
    {
        // Operation map cache already initialized earlier in flow when building operations list
        // Use a fresh reference for safety (no await; in-memory)
        var opMap = operationMapCache.GetAll();
        return usedOperations
            .SelectMany(op => opMap.TryGetValue(op.ActivityName, out var p) ? p : [])
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
    
    private async Task<bool> ConditionSatisfiedAsync(
        string userId,
        string condition,
        List<AuditTargetResource> targets
    )
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
                if (
                    !string.IsNullOrWhiteSpace(t.Id)
                    && await graphService.IsOwnerAsync(userId, t)
                )
                    return true;
            }
            return false;
        }
        // Unknown condition => treat as not satisfied
        return false;
    }
}
