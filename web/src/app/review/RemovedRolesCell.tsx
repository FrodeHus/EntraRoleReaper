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
  if (!r.removedRoles || r.removedRoles.length === 0)
    return <span className="text-muted-foreground">None</span>;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {r.removedRoles.map((role) => (
        <span
          key={role.id}
          className="inline-flex items-center gap-2 px-2 py-0.5 rounded border"
        >
          <button
            type="button"
            onClick={() =>
              openRoleDetails({
                id: role.id,
                name: role.displayName,
                requiredPerms: getRequiredPerms(r),
              })
            }
            className="text-xs underline text-primary hover:opacity-80"
          >
            {roleNameCache[role.id] ?? role.displayName}
          </button>
          <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
            Remove
          </span>
        </span>
      ))}
    </div>
  );
}
