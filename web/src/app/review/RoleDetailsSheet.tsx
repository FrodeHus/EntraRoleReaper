import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
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
  useEffect(() => setOnlyRequiredPerms(false), [open]);

  const reqSet = new Set((role?.requiredPerms ?? []).map((r) => r.toLowerCase()));
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
              <SheetTitle>Role: {details?.name || role.name}</SheetTitle>
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
                    <div>{details.name || role.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={onlyRequiredPerms ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => setOnlyRequiredPerms((v) => !v)}
                      title={onlyRequiredPerms ? "Show all permissions" : "Show only required and covering"}
                    >
                      {onlyRequiredPerms ? "Show all" : "Required only"}
                    </Button>
                  </div>
                </div>
                {details.description && (
                  <div>
                    <div className="font-semibold">Description</div>
                    <div className="text-muted-foreground">{details.description}</div>
                  </div>
                )}
                {details.resourceScopes && details.resourceScopes.length > 0 && (
                  <div>
                    <div className="font-semibold">Resource scopes</div>
                    {details.resourceScopesDetailed && details.resourceScopesDetailed.length > 0 ? (
                      <div className="space-y-1 mt-1 text-xs">
                        {details.resourceScopesDetailed.map((s, i) => (
                          <div key={`${s.value}-${i}`} className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border">{s.value}</span>
                            <span className="text-muted-foreground">{s.description}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {details.resourceScopes.map((s, i) => (
                          <span key={`${s}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div className="font-semibold mb-1">Permissions</div>
                  {details.permissions?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const requiredOnly = details.permissions.filter((p) => {
                          const a = p.action.toLowerCase();
                          if (reqSet.has(a)) return true;
                          for (const r of reqSet) if (covers(a, r)) return true;
                          return false;
                        });
                        const list = onlyRequiredPerms ? requiredOnly : details.permissions;
                        return list.map((p, i) => {
                          const a = p.action.toLowerCase();
                          const isExact = reqSet.has(a);
                          const matchedReq: string[] = [];
                          if (!isExact) {
                            for (const r of reqSet) if (covers(a, r)) matchedReq.push(r);
                          }
                          const isCover = !isExact && matchedReq.length > 0;
                          const title = isExact
                            ? "Required for user's operations"
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
                        });
                      })()}
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
