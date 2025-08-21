import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
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
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  useEffect(() => setOnlyRequiredPerms(false), [open]);
  useEffect(() => {
    // Initialize all permission sets as collapsed when opening / changing role
    if (open) {
      const count = details?.rolePermissions?.length ?? 0;
      // Accordion controlled values: empty => all collapsed
      setOpenKeys([]);
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
                    {/* Expand/Collapse moved into the Permissions card header */}
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
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-sm font-medium">
                        Permissions
                      </CardTitle>
                      {details.rolePermissions &&
                        details.rolePermissions.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const count = details.rolePermissions!.length;
                              if (openKeys.length === count) setOpenKeys([]);
                              else
                                setOpenKeys(
                                  Array.from(
                                    { length: count },
                                    (_, i) => `set-${i}`
                                  )
                                );
                            }}
                            title={
                              openKeys.length ===
                              (details.rolePermissions?.length ?? 0)
                                ? "Collapse all permission sets"
                                : "Expand all permission sets"
                            }
                          >
                            {openKeys.length ===
                            (details.rolePermissions?.length ?? 0)
                              ? "Collapse all"
                              : "Expand all"}
                          </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                      {details.rolePermissions?.length ? (
                        <Accordion
                          type="multiple"
                          value={openKeys}
                          onValueChange={(v) => setOpenKeys(v as string[])}
                          className="w-full"
                        >
                          {details.rolePermissions.map((grp, gi) => {
                            const key = `set-${gi}`;
                            const all = grp.actions;
                            const privCount = all.reduce(
                              (n, a) => n + (a.privileged ? 1 : 0),
                              0
                            );
                            const requiredOnly = all.filter((p) => {
                              const a = p.action.toLowerCase();
                              if (reqSet.has(a)) return true;
                              for (const r of reqSet)
                                if (covers(a, r)) return true;
                              return false;
                            });
                            const list = onlyRequiredPerms ? requiredOnly : all;
                            return (
                              <AccordionItem key={key} value={key}>
                                <AccordionTrigger className="px-2">
                                  <div className="flex items-center gap-2">
                                    <span>Set {gi + 1}</span>
                                    {grp.condition && (
                                      <span
                                        className="text-[10px] px-1 py-0.5 rounded border bg-muted/40"
                                        title="Condition"
                                      >
                                        {grp.condition}
                                      </span>
                                    )}
                                  </div>
                                  <div className="ml-auto flex items-center gap-2">
                                    {privCount > 0 && (
                                      <span
                                        className="text-[10px] px-1 py-0.5 rounded border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                                        title="Privileged actions in this set"
                                      >
                                        {privCount} priv
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      {list.length}/{all.length} shown
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="mb-2 flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7"
                                      onClick={() => {
                                        const ids = all
                                          .map(
                                            (p) =>
                                              (p as any).id || (p as any).Id
                                          )
                                          .filter(Boolean);
                                        onOpenChange(false);
                                        setTimeout(() => {
                                          window.dispatchEvent(
                                            new CustomEvent("open-op-mapping", {
                                              detail: {
                                                mapActivity: true,
                                                preselectedActionIds: ids,
                                              },
                                            })
                                          );
                                        }, 0);
                                      }}
                                      title="Map these actions to an activity"
                                    >
                                      Map
                                    </Button>
                                  </div>
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
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      ) : (
                        <div className="text-muted-foreground">None</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
