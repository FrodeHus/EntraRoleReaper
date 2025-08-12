import type { UserReview } from "./types";

export function AddedRolesCell({
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
  if (!r.addedRoles || r.addedRoles.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }
  return (
    <div className="space-y-1">
      {r.addedRoles.map((role) => (
        <div key={role.id}>
          <button
            type="button"
            onClick={() =>
              openRoleDetails({ id: role.id, name: role.displayName, requiredPerms: getRequiredPerms(r) })
            }
            className="font-medium text-xs underline text-primary hover:opacity-80"
          >
            {roleNameCache[role.id] ?? role.displayName}
          </button>
          <span className="ml-2 align-middle text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px] dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700">
            Add
          </span>
        </div>
      ))}
    </div>
  );
}
