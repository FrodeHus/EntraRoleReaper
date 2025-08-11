import type { UserReview } from "./types";

export function CurrentRolesCell({
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
  if (!r.currentRoleIds || r.currentRoleIds.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  const names = r.currentRoleIds.map((id) => ({ id, name: roleNameCache[id] ?? id }));
  const eligibleSet = new Set(r.eligibleRoleIds ?? []);

  return (
    <div className="flex flex-wrap gap-2">
      {names.map(({ id, name }) => (
        <span key={id} className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              openRoleDetails({ id, name, requiredPerms: getRequiredPerms(r) })
            }
            className="text-xs underline text-primary hover:opacity-80"
            title={id}
          >
            {name}
          </button>
          {eligibleSet.has(id) && (
            <span
              className="text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 text-[10px] dark:text-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700"
              title="Eligible via PIM"
            >
              PIM
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
