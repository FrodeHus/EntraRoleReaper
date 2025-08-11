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
              Why: covers {sr.coveredRequired} required • priv{" "}
              {sr.privilegedAllowed} • total {sr.totalAllowed}
            </div>
          </div>
        ))}
      </div>
    );
  }
  // Fallback to legacy string list
  const suggestedIdSet = new Set(
    r.suggestedRoleIds.filter((s) => isGuid(s)).map((s) => s)
  );
  return (
    <div className="space-y-1">
      <>
        {r.suggestedRoleIds.map((name, i) => (
          <div key={`${name}-${i}`}>
            <button
              type="button"
              onClick={() =>
                openRoleDetails({
                  id: isGuid(name) ? name : undefined,
                  name,
                  requiredPerms: getRequiredPerms(r),
                })
              }
              className="font-medium text-xs underline text-primary hover:opacity-80"
            >
              {isGuid(name) ? roleNameCache[name] ?? name : name}
            </button>
            {isGuid(name) && !r.currentRoleIds.includes(name) && (
              <span className="ml-2 align-middle text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px] dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700">
                Add
              </span>
            )}
          </div>
        ))}
      </>
    </div>
  );
}
