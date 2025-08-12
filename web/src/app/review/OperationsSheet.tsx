import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import type { UserReview } from "./types";
import { useState, useMemo } from "react";

// New OperationsSheet adapted to simplified contract
export function OperationsSheet({
  open,
  onOpenChange,
  review,
  roleNameLookup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: UserReview | null;
  roleNameLookup: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [opFilter, setOpFilter] = useState("");
  const [permFilter, setPermFilter] = useState("");
  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const opData = useMemo(() => {
    if (!review)
      return [] as {
        op: string;
        targets: string[];
        permGroups: { roleId: string; permissions: string[] }[];
        uncovered: string[];
      }[];
    const opLower = opFilter.trim().toLowerCase();
    const permLower = permFilter.trim().toLowerCase();
    return review.operations
      .filter((o) => !opLower || o.operation.toLowerCase().includes(opLower))
      .map((o) => {
        // Group permissions by granting role id(s)
        const groups = new Map<string, Set<string>>();
        const uncovered: string[] = [];
        for (const p of o.permissions) {
          if (!p.grantedByRoleIds || p.grantedByRoleIds.length === 0) {
            uncovered.push(p.name);
          } else {
            for (const rid of p.grantedByRoleIds) {
              if (!groups.has(rid)) groups.set(rid, new Set());
              groups.get(rid)!.add(p.name);
            }
          }
        }
        const initialGroups = Array.from(groups.entries()).map(
          ([roleId, set]) => ({
            roleId,
            permissions: Array.from(set).sort((a, b) =>
              a.localeCompare(b, "en", { sensitivity: "base" })
            ),
          })
        );
        const permGroups = permLower
          ? initialGroups
              .map((g) => ({
                roleId: g.roleId,
                permissions: g.permissions.filter((p) =>
                  p.toLowerCase().includes(permLower)
                ),
              }))
              .filter((g) => g.permissions.length > 0)
          : initialGroups;
        const targets = o.targets
          .map((t) => t.displayName || t.id || "")
          .filter(Boolean);
        const filteredUncovered = permLower
          ? uncovered.filter((p) => p.toLowerCase().includes(permLower))
          : uncovered;
        return {
          op: o.operation,
          targets,
          permGroups,
          uncovered: filteredUncovered,
        };
      });
  }, [review, opFilter, permFilter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {review && (
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Operations for {review.user.displayName}</SheetTitle>
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
                placeholder="Filter operations"
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
                  No operations in period.
                </div>
              )}
              {opData.map((op, idx) => (
                <div
                  key={idx}
                  className="border rounded p-3 bg-card text-card-foreground text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{op.op}</div>
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
                  <div className="space-y-2">
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
                              key={p}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border"
                            >
                              {p}
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
                      <ul className="list-disc pl-4 space-y-1">
                        {op.targets.map((t, i2) => (
                          <li key={i2}>{t}</li>
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
