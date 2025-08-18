import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import type { UserReview } from "./types";
import { useState, useMemo, useRef, useEffect } from "react";
// (Removed unused icons)
import { useAccessToken } from "../hooks/useAccessToken";

// Internal view models
interface OpTargetVM {
  name: string;
  modified: { displayName: string; oldValue?: string; newValue?: string }[];
}
interface PermissionVM { name: string; conditions: string[]; matched: string }
interface PermGroupVM { roleId: string; permissions: PermissionVM[] }
interface OperationVM {
  op: string;
  targets: OpTargetVM[];
  permGroups: PermGroupVM[];
  uncovered: string[];
  grantedMapped: { name: string; isPrivileged: boolean }[];
  mappedMatches: {
    name: string;
    isPrivileged: boolean;
    roles: { roleId: string; matched: string }[];
  }[];
}

// New OperationsSheet adapted to simplified contract
export function OperationsSheet({
  open,
  onOpenChange,
  review,
  roleNameLookup,
  openMapping,
  hasMapping,
  mappingCount,
  apiBase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: UserReview | null;
  roleNameLookup: (id: string) => string;
  openMapping: (operation: string) => void;
  hasMapping: (operation: string) => boolean;
  mappingCount: (operation: string) => number | undefined;
  apiBase: string;
}) {
  const { accessToken } = useAccessToken();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [opFilter, setOpFilter] = useState("");
  const [permFilter, setPermFilter] = useState("");
  const prevCountsRef = useRef<Record<string, number>>({});
  const [animateOps, setAnimateOps] = useState<Set<string>>(new Set());
  const [localHidden, setLocalHidden] = useState<Set<string>>(new Set());
  const [mappedActions, setMappedActions] = useState<
    Record<string, Set<string>>
  >({});
  const [loadingMappings, setLoadingMappings] = useState(false);
  const excludeOp = async (opName: string) => {
    // Optimistic hide
    setLocalHidden((prev) => new Set(prev).add(opName));
    if (!accessToken) return; // cannot persist without token
    try {
      const res = await fetch(new URL(`/api/activity/exclude`, apiBase), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activityName: opName }),
      });
      if (!res.ok) throw new Error();
      // Notify other components (exclusions tab) to refresh
      window.dispatchEvent(new CustomEvent("operation-exclusions-updated"));
    } catch {
      // Revert on failure
      setLocalHidden((prev) => {
        const next = new Set(prev);
        next.delete(opName);
        return next;
      });
    }
  };
  // Track mapping counts to trigger animation
  useEffect(() => {
    if (!review) return;
    const nextAnimate = new Set<string>();
    for (const o of review.operations) {
      const current = mappingCount(o.operation) ?? 0;
      const prev = prevCountsRef.current[o.operation];
      if (prev !== undefined && prev !== current) {
        nextAnimate.add(o.operation);
      }
      prevCountsRef.current[o.operation] = current;
    }
    if (nextAnimate.size > 0) {
      setAnimateOps(nextAnimate);
      const id = setTimeout(() => setAnimateOps(new Set()), 650);
      return () => clearTimeout(id);
    }
  }, [review, mappingCount]);
  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const opData: OperationVM[] = useMemo(() => {
    if (!review) return [];
    const opLower = opFilter.trim().toLowerCase();
    const permLower = permFilter.trim().toLowerCase();
    return review.operations
      .filter((o) => !opLower || o.operation.toLowerCase().includes(opLower))
      .map((o) => {
        // Group permissions by granting role id(s) with conditions
        const groups = new Map<string, Map<string, Set<string>>>(); // roleId -> permName -> conditions
        const matchedByRole = new Map<string, Map<string, string>>(); // roleId -> permName -> matched condition (single)
        const uncovered: string[] = [];
        const currentRoleIds = new Set(review.activeRoles.map((r) => r.id));
        for (const p of o.permissions) {
          if (!p.grantedByRoleIds || p.grantedByRoleIds.length === 0) {
            uncovered.push(p.name);
          } else {
            p.grantedByRoleIds.forEach((rid, idx) => {
              if (!groups.has(rid)) groups.set(rid, new Map());
              if (!matchedByRole.has(rid)) matchedByRole.set(rid, new Map());
              const permMap = groups.get(rid)!;
              if (!permMap.has(p.name)) permMap.set(p.name, new Set());
              const condSet = permMap.get(p.name)!;
              (p.grantConditions || []).forEach((c) => condSet.add(c));
              const matched = p.matchedConditionsPerRole?.[idx];
              if (matched !== undefined) {
                matchedByRole.get(rid)!.set(p.name, matched || "");
              }
            });
          }
        }
        // Compute mapped permissions subset the user actually has with privilege flag
        const grantedMapped = Array.from(
          new Map(
            o.permissions
              .filter((p) =>
                p.grantedByRoleIds?.some((rid) => currentRoleIds.has(rid))
              )
              .map((p) => [p.name, p])
          ).values()
        ).sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        );
        const initialGroups = Array.from(groups.entries()).map(
          ([roleId, permMap]) => ({
            roleId,
            permissions: Array.from(permMap.entries())
              .map(([perm, conds]) => ({
                name: perm,
                conditions: Array.from(conds).sort((a, b) =>
                  a.localeCompare(b, "en", { sensitivity: "base" })
                ),
                matched: matchedByRole.get(roleId)?.get(perm) || "",
              }))
              .sort((a, b) =>
                a.name.localeCompare(b.name, "en", { sensitivity: "base" })
              ),
          })
        );
        const permGroups = permLower
          ? initialGroups
              .map((g) => ({
                roleId: g.roleId,
                permissions: g.permissions.filter((p) =>
                  p.name.toLowerCase().includes(permLower)
                ),
              }))
              .filter((g) => g.permissions.length > 0)
          : initialGroups;
        const targets = o.targets
          .map((t) => ({
            name: t.displayName || t.id || "",
            modified: (t.modifiedProperties || []).map((mp) => ({
              displayName: mp.displayName || "(property)",
              oldValue: mp.oldValue,
              newValue: mp.newValue,
            })),
          }))
          .filter((t) => t.name);
        const filteredUncovered = permLower
          ? uncovered.filter((p) => p.toLowerCase().includes(permLower))
          : uncovered;
        return {
          op: o.operation,
          targets,
          permGroups,
          uncovered: filteredUncovered,
          grantedMapped: grantedMapped.map((p) => ({
            name: p.name,
            isPrivileged: p.isPrivileged,
          })),
          mappedMatches: (() => {
            const mappedSet = mappedActions[o.operation];
            if (!mappedSet || mappedSet.size === 0) return [];
            const activeRoleIds = new Set(review.activeRoles.map((r) => r.id));
            // Build matches from permissions list
            const byAction = new Map<
              string,
              {
                name: string;
                isPrivileged: boolean;
                roles: { roleId: string; matched: string }[];
              }
            >();
            for (const p of o.permissions) {
              if (!mappedSet.has(p.name)) continue; // only mapped actions
              // Determine which granting roles are currently active
              p.grantedByRoleIds.forEach((rid, idx) => {
                if (!activeRoleIds.has(rid)) return; // only active roles
                if (!byAction.has(p.name))
                  byAction.set(p.name, {
                    name: p.name,
                    isPrivileged: p.isPrivileged,
                    roles: [],
                  });
                const matched = p.matchedConditionsPerRole?.[idx] || "";
                byAction.get(p.name)!.roles.push({ roleId: rid, matched });
              });
            }
            // Sort roles inside each action (by roleId for stability)
            const arr = Array.from(byAction.values()).map((a) => ({
              ...a,
              roles: a.roles.sort((r1, r2) =>
                r1.roleId.localeCompare(r2.roleId, "en", {
                  sensitivity: "base",
                })
              ),
            }));
            // Sort actions (privileged first, then name)
            arr.sort((a, b) => {
              if (a.isPrivileged !== b.isPrivileged)
                return a.isPrivileged ? -1 : 1;
              return a.name.localeCompare(b.name, "en", {
                sensitivity: "base",
              });
            });
            return arr;
          })(),
        };
      }) as OperationVM[];
  }, [review, opFilter, permFilter]);

  // Load mapped actions for currently displayed operations (operation-level only; property-level mapping could be added similarly)
  useEffect(() => {
    if (!review || !accessToken) return;
    const opsToLoad = review.operations
      .map((o) => o.operation)
      .filter((op) => hasMapping(op) && !mappedActions[op]);
    if (opsToLoad.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoadingMappings(true);
      try {
        const entries: [string, Set<string>][] = [];
        for (const op of opsToLoad) {
          try {
            const res = await fetch(
              new URL(
                `/api/activity/mapping/${encodeURIComponent(op)}`,
                apiBase
              ),
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!res.ok) continue;
            const json = await res.json();
            const mapped = Array.isArray(json?.MappedActions)
              ? (json.MappedActions as any[]).map((a) => String(a))
              : Array.isArray(json?.mapped)
              ? (json.mapped as any[]).map((a) => String(a))
              : [];
            const unionSet = new Set<string>();
            for (const a of mapped) if (a) unionSet.add(a);
            entries.push([op, unionSet]);
          } catch {
            // ignore per-op failure
          }
        }
        if (!cancelled && entries.length > 0) {
          setMappedActions((prev) => {
            const next = { ...prev };
            for (const [k, v] of entries) next[k] = v;
            return next;
          });
        }
      } finally {
        if (!cancelled) setLoadingMappings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [review, accessToken, apiBase, hasMapping]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {review && (
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Activities for {review.user.displayName}</SheetTitle>
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
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input
                placeholder="Filter activities"
                className="border rounded px-2 py-1 text-xs w-1/2 bg-background"
                value={opFilter}
                onChange={(e) => setOpFilter(e.target.value)}
              />
              <input
                placeholder="Filter permissions"
                className="border rounded px-2 py-1 text-xs w-1/2 bg-background"
                value={permFilter}
                onChange={(e) => setPermFilter(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setOpFilter("");
                  setPermFilter("");
                }}
                disabled={!opFilter && !permFilter}
              >
                Clear
              </Button>
            </div>
            <div className="space-y-3">
              {opData.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No activities in period.
                </div>
              )}
              {opData
                .filter((o) => !localHidden.has(o.op))
                .map((op, idx) => (
                  <div
                    key={idx}
                    className="border rounded p-3 bg-card text-card-foreground text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <span>{op.op}</span>
                          {(() => {
                            const count =
                              mappingCount(op.op) ??
                              op.grantedMapped.length ??
                              0;
                            const animate = animateOps.has(op.op) && count > 0;
                            return (
                              <span
                                className={
                                  `text-[10px] px-1 py-0.5 rounded border transition-transform ` +
                                  (count === 0
                                    ? "bg-transparent text-muted-foreground border-muted-foreground/30"
                                    : "bg-muted text-muted-foreground") +
                                  (animate ? " animate-badge-pulse" : "")
                                }
                                title={
                                  count === 0
                                    ? "No mapped permissions yet"
                                    : `${count} mapped permissions`
                                }
                              >
                                {count} mapped
                              </span>
                            );
                          })()}
                        </div>
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => openMapping(op.op)}
                            className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {hasMapping(op.op)
                              ? "Edit mapping"
                              : "Create mapping"}
                          </button>
                          <button
                            type="button"
                            onClick={() => excludeOp(op.op)}
                            className="ml-3 text-[11px] text-red-600 hover:underline dark:text-red-400"
                            title="Exclude this activity from reviews"
                          >
                            Exclude
                          </button>
                        </div>
                      </div>
                      {op.targets.length > 0 && (
                        <Button
                          variant="link"
                          className="text-[11px] p-0 h-auto"
                          onClick={() => toggleExpanded(idx)}
                        >
                          {expanded.has(idx) ? "Hide targets" : "Targets"}
                        </Button>
                      )}
                    </div>
                    {hasMapping(op.op) && op.grantedMapped.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {op.grantedMapped.map((p) => (
                          <span
                            key={p.name}
                            className={
                              `inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ` +
                              (p.isPrivileged
                                ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-700 dark:text-red-300"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-700 dark:text-emerald-300")
                            }
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {/* Mapped resource actions actually granted by current roles */}
                      {loadingMappings && hasMapping(op.op) && (
                        <div className="text-[11px] text-muted-foreground">
                          Loading mapped actions…
                        </div>
                      )}
                      {op.mappedMatches.length > 0 && (
                        <div>
                          <div className="font-medium">
                            Mapped resource actions
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            {op.mappedMatches.map((m) => (
                              <div
                                key={m.name}
                                className={
                                  `flex flex-wrap items-center gap-2 text-[11px] border rounded px-2 py-1 ` +
                                  (m.isPrivileged
                                    ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-700"
                                    : "bg-muted/40")
                                }
                              >
                                <span className="font-mono">{m.name}</span>
                                {m.roles.map((r, i) => (
                                  <span
                                    key={r.roleId + i}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-background/70 dark:bg-background/30"
                                    title={
                                      r.matched
                                        ? `Condition: ${r.matched}`
                                        : "Unconditional"
                                    }
                                  >
                                    <span>{roleNameLookup(r.roleId)}</span>
                                    {r.matched && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300/60">
                                        {r.matched}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {op.permGroups.map((g) => (
                        <div key={g.roleId}>
                          <div className="font-medium flex items-center gap-2">
                            <span>{roleNameLookup(g.roleId) ?? g.roleId}</span>
                            {review.eligiblePimRoles.some(
                              (r) => r.id === g.roleId
                            ) && (
                              <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 text-[10px] dark:text-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700">
                                PIM
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {g.permissions.map((p) => (
                              <span
                                key={p.name}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border"
                              >
                                <span>{p.name}</span>
                                {p.matched && (
                                  <span
                                    className="text-[9px] px-1 py-0.5 rounded border bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                                    title={
                                      p.matched
                                        ? `Matched condition: ${p.matched}`
                                        : "Unconditional"
                                    }
                                  >
                                    {p.matched || "unconditional"}
                                  </span>
                                )}
                                {p.conditions.map((c, i) => (
                                  <span
                                    key={i}
                                    className="text-[9px] px-1 py-0.5 rounded border bg-muted/60 text-muted-foreground"
                                    title={`Condition: ${c}`}
                                  >
                                    {c}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {op.uncovered.length > 0 && (
                        <div>
                          <div className="font-medium">Uncovered</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {op.uncovered.map((p) => (
                              <span
                                key={p}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {expanded.has(idx) && op.targets.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="font-medium mb-1">Targets</div>
                        <ul className="list-disc pl-4 space-y-2">
                          {op.targets.map((t, i2) => (
                            <li key={i2}>
                              <div>{t.name}</div>
                              {t.modified && t.modified.length > 0 && (
                                <div className="mt-1 ml-2 border-l pl-3 space-y-1">
                                  {t.modified.map(
                                    (
                                      mp: {
                                        displayName: string;
                                        oldValue?: string;
                                        newValue?: string;
                                      },
                                      mIdx: number
                                    ) => {
                                      const propToken = `${op.op}::${mp.displayName}`;
                                      return (
                                        <div
                                          key={mIdx}
                                          className="text-[10px] font-mono break-all group relative pr-16"
                                        >
                                          <span className="font-semibold">
                                            {mp.displayName}:
                                          </span>{" "}
                                          <span className="text-red-600 dark:text-red-400">
                                            {mp.oldValue ?? ""}
                                          </span>{" "}
                                          <span className="mx-1">→</span>
                                          <span className="text-emerald-600 dark:text-emerald-400">
                                            {mp.newValue ?? ""}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openMapping(propToken)
                                            }
                                            className="absolute top-0 right-0 opacity-70 group-hover:opacity-100 text-[9px] px-1 py-0.5 border rounded bg-muted text-muted-foreground hover:bg-muted/80 transition"
                                            title="Map actions for this specific property change"
                                          >
                                            Map
                                          </button>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
