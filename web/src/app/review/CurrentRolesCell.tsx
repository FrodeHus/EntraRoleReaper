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

  return (
    <div className="flex flex-wrap gap-2">
      {names.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          onClick={() => openRoleDetails({ id, name, requiredPerms: getRequiredPerms(r) })}
          className="text-xs underline text-primary hover:opacity-80"
          title={id}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
