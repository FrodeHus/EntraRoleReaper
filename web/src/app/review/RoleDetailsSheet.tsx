import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
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
import ResourceActionList from "@/components/ResourceActionList";
type RoleInfo = { name: string; requiredPerms?: string[] };

function covers(grant: string, required: string): boolean {
  const g = grant.toLowerCase();
  const r = required.toLowerCase();
  if (g === r) return true;
  if (g.endsWith("/*") && r.startsWith(g.slice(0, -1))) return true;
  const gs = g.split("/");
  const rs = r.split("/");
  if (gs.length === rs.length) {
    if (gs.every((seg, i) => seg === "*" || seg === rs[i])) return true;
  }
  return false;
}

export function RoleDetailsSheet({
  open,
  onOpenChange,
  role,
  details,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleInfo | null;
  details: RoleDetails;
  loading?: boolean;
}) {
  const [onlyRequiredPerms, setOnlyRequiredPerms] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  // list/grouped toggle removed; we render ResourceActionList per permission set

  const reqSet = useMemo(() => {
    const arr = role?.requiredPerms ?? [];
    return new Set(arr.map((s) => s.toLowerCase()));
  }, [role]);

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
                      <div className="flex items-center gap-2">
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
                      </div>
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
                                  <div id={`perm-set-${gi}`}>
                                    <ResourceActionList
                                      actions={list.map((p: any) => ({
                                        action: p.action,
                                        id: p?.id ?? p?.Id ?? p?.ID,
                                        isPrivileged: Boolean(
                                          (p as any).privileged
                                        ),
                                      }))}
                                      hideControls
                                      compact
                                    />
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
