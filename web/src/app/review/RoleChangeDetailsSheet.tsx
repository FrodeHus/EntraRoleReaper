import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import type { UserReview } from "./types";

export function RoleChangeDetailsSheet({
  open,
  onOpenChange,
  review,
  roleNameLookup,
  openRoleDetails,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  review: UserReview | null;
  roleNameLookup: (id: string) => string;
  openRoleDetails: (opts: { id?: string; name: string; requiredPerms: string[] }) => void;
}) {
  if (!review) return <Sheet open={open} onOpenChange={onOpenChange}>{null}</Sheet>;
  const requiredPerms = new Set<string>();
  for (const op of review.operations) for (const p of op.permissions) requiredPerms.add(p.name.toLowerCase());
  const req = Array.from(requiredPerms);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Role changes – {review.user.displayName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6 text-sm">
          <div>
            <div className="font-medium mb-2">
              Current roles ({review.activeRoles.length})
            </div>
            {review.activeRoles.length === 0 ? (
              <div className="text-muted-foreground">None</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {review.activeRoles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 px-2 py-0.5 rounded border"
                  >
                    <button
                      type="button"
                      className="text-xs underline text-primary hover:opacity-80"
                      onClick={() =>
                        openRoleDetails({
                          id: r.id,
                          name: r.displayName,
                          requiredPerms: req,
                        })
                      }
                    >
                      {roleNameLookup(r.id)}
                    </button>
                    {review.eligiblePimRoles.some((er) => er.id === r.id) && (
                      <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 text-[10px] dark:text-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700">
                        PIM
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          {(() => {
            const activeIds = new Set(review.activeRoles.map((r) => r.id));
            const eligibleNotActive = review.eligiblePimRoles.filter(
              (r) => !activeIds.has(r.id)
            );
            return (
              <div>
                <div className="font-medium mb-2 text-indigo-600 dark:text-indigo-400">
                  Eligible roles (not active) ({eligibleNotActive.length})
                </div>
                {eligibleNotActive.length === 0 ? (
                  <div className="text-muted-foreground">None</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {eligibleNotActive.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
                      >
                        <button
                          type="button"
                          className="text-xs underline text-primary hover:opacity-80"
                          onClick={() =>
                            openRoleDetails({
                              id: r.id,
                              name: r.displayName,
                              requiredPerms: req,
                            })
                          }
                        >
                          {roleNameLookup(r.id)}
                        </button>
                        <span className="text-indigo-700 dark:text-indigo-300 text-[10px]">
                          Eligible
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div>
            <div className="font-medium mb-2 text-emerald-600 dark:text-emerald-400">
              Added roles ({review.addedRoles.length})
            </div>
            {review.addedRoles.length === 0 ? (
              <div className="text-muted-foreground">None</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {review.addedRoles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
                  >
                    <button
                      type="button"
                      className="text-xs underline text-primary hover:opacity-80"
                      onClick={() =>
                        openRoleDetails({
                          id: r.id,
                          name: r.displayName,
                          requiredPerms: req,
                        })
                      }
                    >
                      {roleNameLookup(r.id)}
                    </button>
                    <span className="text-emerald-700 dark:text-emerald-300 text-[10px]">
                      Add
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="font-medium mb-2 text-red-600 dark:text-red-400">
              Removed roles ({review.removedRoles.length})
            </div>
            {review.removedRoles.length === 0 ? (
              <div className="text-muted-foreground">None</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {review.removedRoles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                  >
                    <button
                      type="button"
                      className="text-xs underline text-primary hover:opacity-80"
                      onClick={() =>
                        openRoleDetails({
                          id: r.id,
                          name: r.displayName,
                          requiredPerms: req,
                        })
                      }
                    >
                      {roleNameLookup(r.id)}
                    </button>
                    <span className="text-red-700 dark:text-red-300 text-[10px]">
                      Remove
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
