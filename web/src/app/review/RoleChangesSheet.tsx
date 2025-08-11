import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import type { UserReview } from "./types";

const isGuid = (s: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    s
  );

export function RoleChangesSheet({
  open,
  onOpenChange,
  review,
  roleNameCache,
  openRoleDetails,
  getRequiredPerms,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  review: UserReview | null;
  roleNameCache: Record<string, string>;
  openRoleDetails: (opts: { id?: string; name: string; requiredPerms: string[] }) => void;
  getRequiredPerms: (r: UserReview) => string[];
}) {
  const r = review;
  let currentIds: string[] = [];
  let suggestedIds: string[] = [];
  const srNamesMap: Record<string, string> = {};

  if (r) {
    currentIds = r.currentRoleIds ?? [];
    const fromStructured = (r.suggestedRoles ?? [])
      .map((sr) => {
        const id = (sr as any).id as string | undefined;
        if (id) srNamesMap[id] = sr.name;
        return id;
      })
      .filter((x): x is string => !!x);
    if (fromStructured.length > 0) suggestedIds = fromStructured;
    else suggestedIds = (r.suggestedRoleIds ?? []).filter((s) => isGuid(s));
  }

  const current = currentIds.map((id) => ({ id, name: roleNameCache[id] ?? id }));
  const suggestedSet = new Set(suggestedIds);
  const toAdd = suggestedIds
    .filter((id) => !currentIds.includes(id))
    .map((id) => ({ id, name: srNamesMap[id] ?? roleNameCache[id] ?? id }));
  const toRemove = suggestedSet.size > 0
    ? currentIds.filter((id) => !suggestedSet.has(id)).map((id) => ({ id, name: roleNameCache[id] ?? id }))
    : [];

  const eligibleSet = new Set(r?.eligibleRoleIds ?? []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Role changes</SheetTitle>
        </SheetHeader>
        {!r ? null : (
          <div className="mt-4 space-y-6 text-sm">
            <div>
              <div className="font-medium mb-2">
                Current roles ({current.length})
              </div>
              {current.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {current.map(({ id, name }) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 px-2 py-0.5 rounded border"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openRoleDetails({
                            id,
                            name,
                            requiredPerms: getRequiredPerms(r),
                          })
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
              )}
            </div>

            <div>
              <div className="font-medium mb-2 text-emerald-600 dark:text-emerald-400">
                Will add ({toAdd.length})
              </div>
              {toAdd.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {toAdd.map(({ id, name }) => (
                    <span
                      key={`add-${id}`}
                      className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openRoleDetails({
                            id,
                            name,
                            requiredPerms: getRequiredPerms(r),
                          })
                        }
                        className="text-xs underline text-primary hover:opacity-80"
                      >
                        {name}
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
                Will remove ({toRemove.length})
              </div>
              {toRemove.length === 0 ? (
                <div className="text-muted-foreground">None</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {toRemove.map(({ id, name }) => (
                    <span
                      key={`rm-${id}`}
                      className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openRoleDetails({
                            id,
                            name,
                            requiredPerms: getRequiredPerms(r),
                          })
                        }
                        className="text-xs underline text-primary hover:opacity-80"
                      >
                        {name}
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
        )}
      </SheetContent>
    </Sheet>
  );
}
