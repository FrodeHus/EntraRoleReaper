import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import type { RoleDetails } from "./types";

export function RoleDetailsSheet({
  open,
  onOpenChange,
  role,
  details,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: { name: string; requiredPerms: string[] } | null;
  details: RoleDetails;
  loading: boolean;
}) {
  const [onlyRequiredPerms, setOnlyRequiredPerms] = useState(false);
  const [collapsedSets, setCollapsedSets] = useState<Set<number>>(new Set());
  useEffect(() => setOnlyRequiredPerms(false), [open]);
  useEffect(() => {
    // Initialize all permission sets as collapsed when opening / changing role
    if (open) {
      const count = details?.rolePermissions?.length ?? 0;
      setCollapsedSets(new Set(Array.from({ length: count }, (_, i) => i)));
    }
  }, [open, details?.id, details?.name, details?.rolePermissions?.length]);

  const reqSet = new Set(
    (role?.requiredPerms ?? []).map((r) => r.toLowerCase())
  );
  const covers = (action: string, required: string) => {
    const a = action.toLowerCase();
    const r = required.toLowerCase();
    if (a === r) return true;
    if (a.endsWith("/*")) {
      const prefix = a.slice(0, -2);
      return r.startsWith(prefix + "/") || r === prefix;
    }
    if (r.startsWith(a + "/")) return true;
    return false;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {role && (
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>
                Role:{" "}
                {details?.name || (details as any)?.displayName || role.name}
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </SheetHeader>
          <div className="mt-3 space-y-3 text-sm">
            {loading && <div className="text-muted-foreground">Loading…</div>}
            {!loading && details && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Name</div>
                    <div>
                      {details.name ||
                        (details as any)?.displayName ||
                        role.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Required only
                      </span>
                      <Switch
                        checked={onlyRequiredPerms}
                        onCheckedChange={(v) =>
                          setOnlyRequiredPerms(Boolean(v))
                        }
                        aria-label="Show only required and covering permissions"
                        disabled={loading}
                      />
                    </div>
                    {details.rolePermissions &&
                      details.rolePermissions.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            if (
                              collapsedSets.size ===
                              details.rolePermissions.length
                            ) {
                              setCollapsedSets(new Set());
                            } else {
                              setCollapsedSets(
                                new Set(
                                  details.rolePermissions.map((_, i) => i)
                                )
                              );
                            }
                          }}
                          title={
                            collapsedSets.size ===
                            details.rolePermissions.length
                              ? "Expand all permission sets"
                              : "Collapse all permission sets"
                          }
                        >
                          {collapsedSets.size === details.rolePermissions.length
                            ? "Expand all"
                            : "Collapse all"}
                        </Button>
                      )}
                  </div>
                </div>
                {details.description && (
                  <div>
                    <div className="font-semibold">Description</div>
                    <div className="text-muted-foreground">
                      {details.description}
                    </div>
                  </div>
                )}
                {details.resourceScopes &&
                  details.resourceScopes.length > 0 && (
                    <div>
                      <div className="font-semibold">Resource scopes</div>
                      {details.resourceScopesDetailed &&
                      details.resourceScopesDetailed.length > 0 ? (
                        <div className="space-y-1 mt-1 text-xs">
                          {details.resourceScopesDetailed.map((s, i) => (
                            <div
                              key={`${s.value}-${i}`}
                              className="flex items-center gap-2"
                            >
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border">
                                {s.value}
                              </span>
                              <span className="text-muted-foreground">
                                {s.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {details.resourceScopes.map((s, i) => (
                            <span
                              key={`${s}-${i}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                <div>
                  <div className="font-semibold mb-1">Permissions</div>
                  {details.rolePermissions?.length ? (
                    <div className="space-y-4">
                      {details.rolePermissions.map((grp, gi) => {
                        const all = grp.actions;
                        const privCount = all.reduce(
                          (n, a) => n + (a.privileged ? 1 : 0),
                          0
                        );
                        const requiredOnly = all.filter((p) => {
                          const a = p.action.toLowerCase();
                          if (reqSet.has(a)) return true;
                          for (const r of reqSet) if (covers(a, r)) return true;
                          return false;
                        });
                        const list = onlyRequiredPerms ? requiredOnly : all;
                        const collapsed = collapsedSets.has(gi);
                        return (
                          <div key={gi} className="space-y-1">
                            <div className="text-xs font-medium flex items-center gap-2 select-none">
                              <button
                                type="button"
                                onClick={() => {
                                  setCollapsedSets((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(gi)) next.delete(gi);
                                    else next.add(gi);
                                    return next;
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-1 py-0.5 rounded border bg-muted/40 hover:bg-muted transition-colors"
                                aria-controls={`perm-set-${gi}`}
                              >
                                <span className="text-[10px]">
                                  {collapsed ? "▸" : "▾"}
                                </span>
                                <span>Set {gi + 1}</span>
                              </button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => {
                                  const ids = all
                                    .map((p) => (p as any).id || (p as any).Id)
                                    .filter(Boolean);
                                  window.dispatchEvent(
                                    new CustomEvent("open-op-mapping", {
                                      detail: {
                                        mapActivity: true,
                                        preselectedActionIds: ids,
                                      },
                                    })
                                  );
                                }}
                                title="Map these actions to an activity"
                              >
                                Map
                              </Button>
                              {grp.condition && (
                                <span
                                  className="text-[10px] px-1 py-0.5 rounded border bg-muted/40"
                                  title="Condition"
                                >
                                  {grp.condition}
                                </span>
                              )}
                              {privCount > 0 && (
                                <span
                                  className="text-[10px] px-1 py-0.5 rounded border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                                  title="Privileged actions in this set"
                                >
                                  {privCount} priv
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {list.length}/{all.length} shown
                              </span>
                            </div>
                            {!collapsed && (
                              <div
                                className="flex flex-wrap gap-2"
                                id={`perm-set-${gi}`}
                              >
                                {list.map((p, i) => {
                                  const a = p.action.toLowerCase();
                                  const isExact = reqSet.has(a);
                                  const matchedReq: string[] = [];
                                  if (!isExact) {
                                    for (const r of reqSet)
                                      if (covers(a, r)) matchedReq.push(r);
                                  }
                                  const isCover =
                                    !isExact && matchedReq.length > 0;
                                  const title = isExact
                                    ? "Required for user's activities"
                                    : isCover
                                    ? `Covers: ${matchedReq.join(", ")}`
                                    : undefined;
                                  return (
                                    <span
                                      key={`${p.action}-${i}`}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                                        isExact || isCover
                                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                                          : ""
                                      }`}
                                      title={title}
                                    >
                                      <span>{p.action}</span>
                                      {isExact && (
                                        <span className="text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 text-[10px] dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-700">
                                          Required
                                        </span>
                                      )}
                                      {isCover && (
                                        <span className="text-blue-700 bg-blue-50 border border-blue-200 rounded px-1 text-[10px] dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-700">
                                          Covers
                                        </span>
                                      )}
                                      {p.privileged && (
                                        <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                                          Privileged
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">None</div>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
