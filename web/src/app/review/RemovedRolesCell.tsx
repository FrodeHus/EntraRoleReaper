import type { UserReview } from "./types";

export function RemovedRolesCell({
  review,
  roleNameCache,
  openRoleDetails,
  getRequiredPerms,
}: {
  review: UserReview;
  roleNameCache: Record<string, string>;
  openRoleDetails: (opts: { id?: string; name: string; requiredPerms: string[] }) => void;
  getRequiredPerms: (r: UserReview) => string[];
}) {
  const r = review;
  const suggestedIdSet = new Set(
    (r.suggestedRoles ?? [])
      .map((sr) => (sr as any).id as string | undefined)
      .filter((x): x is string => !!x)
  );
  const legacySuggest = new Set(r.suggestedRoleIds);

  // If we have suggested roles with ids, use that to compute removals.
  // Else fallback to legacy list (string match).
  const removals = r.currentRoleIds.filter((id) =>
    suggestedIdSet.size > 0 ? !suggestedIdSet.has(id) : !legacySuggest.has(id)
  );

  if (removals.length === 0) return <span className="text-muted-foreground">None</span>;

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {removals.map((id) => (
        <span key={id} className="inline-flex items-center gap-2 px-2 py-0.5 rounded border">
          <button
            type="button"
            onClick={() =>
              openRoleDetails({
                id,
                name: roleNameCache[id] ?? id,
                requiredPerms: getRequiredPerms(r),
              })
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
  );
}
