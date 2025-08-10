import type { UserReview } from "./types";

const isGuid = (s: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    s
  );

export function SuggestedRolesCell({
  review,
  getRequiredPerms,
  openRoleDetails,
  roleNameCache,
}: {
  review: UserReview;
  getRequiredPerms: (r: UserReview) => string[];
  openRoleDetails: (opts: { id?: string; name: string; requiredPerms: string[] }) => void;
  roleNameCache: Record<string, string>;
}) {
  const r = review;
  const roles = r.suggestedRoles;
  if (roles && roles.length > 0) {
    const suggestedIdSet = new Set(
      roles.map((sr) => (sr as any).id as string | undefined).filter((x): x is string => !!x)
    );
    const removals = r.currentRoleIds.filter((id) =>
      suggestedIdSet.size > 0 ? !suggestedIdSet.has(id) : false
    );
    return (
      <div className="space-y-1">
        {roles.map((sr, i) => (
          <div key={`${sr.name}-${i}`}>
            <button
              type="button"
              onClick={() =>
                openRoleDetails({
                  id: (sr as any).id,
                  name: sr.name,
                  requiredPerms: getRequiredPerms(r),
                })
              }
              className="font-medium text-xs underline text-primary hover:opacity-80"
            >
              {sr.name}
            </button>
            {(sr as any).id && !r.currentRoleIds.includes((sr as any).id) && (
              <span className="ml-2 align-middle text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px] dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700">
                Add
              </span>
            )}
            <div className="text-[11px] text-muted-foreground">
              Why: covers {sr.coveredRequired} required • priv {sr.privilegedAllowed} • total {sr.totalAllowed}
            </div>
          </div>
        ))}
        {removals.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {removals.map((id, j) => (
              <span key={`rm-${id}-${j}`} className="inline-flex items-center gap-2 px-2 py-0.5 rounded border">
                <button
                  type="button"
                  onClick={() =>
                    openRoleDetails({ id, name: roleNameCache[id] ?? id, requiredPerms: getRequiredPerms(r) })
                  }
                  className="text-xs underline text-primary hover:opacity-80"
                >
                  {roleNameCache[id] ?? id}
                </button>
                <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                  Remove
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }
  // Fallback to legacy string list
  const suggestedIdSet = new Set(r.suggestedRoleIds.filter((s) => isGuid(s)).map((s) => s));
  const removals = r.currentRoleIds.filter((id) =>
    suggestedIdSet.size > 0 ? !suggestedIdSet.has(id) : false
  );
  return (
    <div className="space-y-1">
      <>
        {r.suggestedRoleIds.map((name, i) => (
          <div key={`${name}-${i}`}>
            <button
              type="button"
              onClick={() =>
                openRoleDetails({ id: isGuid(name) ? name : undefined, name, requiredPerms: getRequiredPerms(r) })
              }
              className="font-medium text-xs underline text-primary hover:opacity-80"
            >
              {name}
            </button>
            {isGuid(name) && !r.currentRoleIds.includes(name) && (
              <span className="ml-2 align-middle text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px] dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700">
                Add
              </span>
            )}
          </div>
        ))}
        {removals.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {removals.map((id, j) => (
              <span key={`rm-${id}-${j}`} className="inline-flex items-center gap-2 px-2 py-0.5 rounded border">
                <button
                  type="button"
                  onClick={() =>
                    openRoleDetails({ id, name: roleNameCache[id] ?? id, requiredPerms: getRequiredPerms(r) })
                  }
                  className="text-xs underline text-primary hover:opacity-80"
                >
                  {roleNameCache[id] ?? id}
                </button>
                <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                  Remove
                </span>
              </span>
            ))}
          </div>
        )}
      </>
    </div>
  );
}
