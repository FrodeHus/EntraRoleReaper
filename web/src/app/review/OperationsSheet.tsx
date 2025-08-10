import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import type { UserReview } from "./types";
import { useState } from "react";

export function OperationsSheet({
  open,
  onOpenChange,
  review,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: UserReview | null;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {review && (
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Operations for {review.userDisplayName}</SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                title="Close"
              >
                Close
              </Button>
            </div>
          </SheetHeader>
          <div className="space-y-3 mt-3">
            {review.operations.map((op, idx) => (
              <div key={idx} className="border rounded p-3 bg-card text-card-foreground">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{op.operation}</div>
                  {op.targets && op.targets.length > 0 && (
                    <Button
                      variant="link"
                      className="text-xs p-0 h-auto"
                      onClick={() => toggleExpanded(idx)}
                    >
                      {expanded.has(idx) ? "Hide details" : "Details"}
                    </Button>
                  )}
                </div>
                <div className="mt-2 space-y-2 text-xs">
                  {(() => {
                    const list =
                      op.permissionDetails && op.permissionDetails.length > 0
                        ? op.permissionDetails
                        : op.requiredPermissions.map((n) => ({
                            name: n,
                            privileged: false,
                            grantedByRoles: [] as string[],
                          }));
                    if (list.length === 0) {
                      return <span className="text-muted-foreground">No mapping</span>;
                    }
                    const groups = new Map<string, { name: string; privileged: boolean }[]>();
                    const uncovered: { name: string; privileged: boolean }[] = [];
                    for (const pd of list) {
                      const roles = pd.grantedByRoles && pd.grantedByRoles.length > 0 ? pd.grantedByRoles : [];
                      if (roles.length === 0) {
                        uncovered.push({ name: pd.name, privileged: pd.privileged });
                      } else {
                        for (const rn of roles) {
                          const arr = groups.get(rn) ?? [];
                          arr.push({ name: pd.name, privileged: pd.privileged });
                          groups.set(rn, arr);
                        }
                      }
                    }
                    const roleSections = Array.from(groups.entries()).sort(([a], [b]) =>
                      a.localeCompare(b, undefined, { sensitivity: "base" })
                    );
                    return (
                      <div className="space-y-2">
                        {roleSections.map(([roleName, items]) => (
                          <div key={roleName}>
                            <div className="font-semibold bg-card text-card-foreground mb-1 flex items-center gap-2">
                              <span>{roleName}</span>
                              {(() => {
                                const meta = review.roleMeta?.find(
                                  (m) => m.name.toLowerCase() === roleName.toLowerCase()
                                );
                                if (meta?.pim) {
                                  return (
                                    <span className="text-purple-700 bg-purple-50 border border-purple-200 rounded px-1 text-[10px] dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700">
                                      PIM
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {items.map((it, i) => (
                                <span key={`${roleName}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border">
                                  <span>{it.name}</span>
                                  {it.privileged && (
                                    <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                                      Privileged
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {uncovered.length > 0 && (
                          <div>
                            <div className="font-semibold text-foreground mb-1">Uncovered</div>
                            <div className="flex flex-wrap gap-2">
                              {uncovered.map((it, i) => (
                                <span key={`uncovered-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border">
                                  <span>{it.name}</span>
                                  {it.privileged && (
                                    <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px] dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                                      Privileged
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {expanded.has(idx) && op.targets && op.targets.length > 0 && (
                  <div className="mt-2 border rounded bg-muted p-2">
                    <div className="font-semibold text-xs mb-1">Targets</div>
                    <div className="space-y-1 text-xs">
                      {op.targets.map((t, i2) => {
                        const name = t.displayName || t.id || "Unknown";
                        const metaParts: string[] = [];
                        if (t.label) metaParts.push(t.label);
                        else if (t.type) metaParts.push(t.type);
                        if (t.id) metaParts.push(t.id);
                        const meta = metaParts.join(" • ");
                        return (
                          <div key={i2}>
                            <div className="font-medium text-[0.8rem]">{name}</div>
                            {meta && <div className="text-muted-foreground">{meta}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
