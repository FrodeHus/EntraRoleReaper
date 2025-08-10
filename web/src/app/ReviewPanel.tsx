import { useEffect, useMemo, useState } from "react";
import { formatISO, subHours, subDays } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";

export type ReviewRequest = {
  usersOrGroups: string[];
  from: string;
  to: string;
};

type UserReview = {
  userId: string;
  userDisplayName: string;
  currentRoleIds: string[];
  eligibleRoleIds?: string[];
  usedOperations: string[];
  suggestedRoleIds: string[];
  operationCount: number;
  roleMeta?: { name: string; pim: boolean }[];
  operations: {
    operation: string;
    requiredPermissions: string[];
    targets: {
      id?: string;
      displayName?: string;
      type?: string;
      label?: string;
    }[];
    permissionDetails?: {
      name: string;
      privileged: boolean;
      grantedByRoles?: string[];
    }[];
  }[];
};

type ReviewResponse = { results: UserReview[] };

export function ReviewPanel({
  accessToken,
  selectedIds,
}: {
  accessToken: string | null;
  selectedIds: string[];
}) {
  const timeRanges = [
    {
      label: "Last 3 hours",
      value: "3h",
      getFrom: () => formatISO(subHours(new Date(), 3)),
    },
    {
      label: "Last 24 hours",
      value: "24h",
      getFrom: () => formatISO(subHours(new Date(), 24)),
    },
    {
      label: "Last 3 days",
      value: "3d",
      getFrom: () => formatISO(subDays(new Date(), 3)),
    },
    {
      label: "Last 14 days",
      value: "14d",
      getFrom: () => formatISO(subDays(new Date(), 14)),
    },
    {
      label: "Last 30 days",
      value: "30d",
      getFrom: () => formatISO(subDays(new Date(), 30)),
    },
  ];
  const [selectedRange, setSelectedRange] = useState<string>("30d");
  const to = formatISO(new Date());
  const from = useMemo(() => {
    const found = timeRanges.find((r) => r.value === selectedRange);
    return found
      ? found.getFrom()
      : timeRanges[timeRanges.length - 1].getFrom();
  }, [selectedRange]);
  const [report, setReport] = useState<UserReview[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"ops" | "name">("ops");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [openSheetFor, setOpenSheetFor] = useState<UserReview | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Reset expanded state when switching user/sheet
    setExpanded(new Set());
  }, [openSheetFor]);

  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const run = async () => {
    if (!accessToken || selectedIds.length === 0) return;
    const payload: ReviewRequest = { usersOrGroups: selectedIds, from, to };
    try {
      setLoading(true);
      const res = await fetch(
        new URL("/api/review", import.meta.env.VITE_API_URL),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) return;
      const json: ReviewResponse = await res.json();
      setReport(json.results);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const sorted = useMemo(() => {
    if (!report) return [] as UserReview[];
    const copy = [...report];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "ops") {
        cmp = a.operationCount - b.operationCount;
      } else {
        // Case-insensitive locale compare for userDisplayName
        cmp = a.userDisplayName.localeCompare(b.userDisplayName, undefined, {
          sensitivity: "base",
        });
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [report, sortBy, sortAsc]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const remediation = useMemo(() => {
    if (!report || selection.length === 0) return [] as UserReview[];
    return report.filter((r) => selection.includes(r.userId));
  }, [report, selection]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!report) return;
    const data = selection.length > 0 ? remediation : report;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const ts = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fname = `entra-review-${ts.getFullYear()}${pad(
      ts.getMonth() + 1
    )}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
    downloadBlob(blob, fname);
  };

  const toCsv = (rows: Array<Record<string, unknown>>): string => {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown) => {
      const s = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => esc((row as any)[h])).join(","));
    }
    return lines.join("\n");
  };

  const exportCsv = () => {
    if (!report) return;
    const data = selection.length > 0 ? remediation : report;
    const rows = data.map((r) => ({
      userId: r.userId,
      userDisplayName: r.userDisplayName,
      operationCount: r.operationCount,
      suggestedRoleIds: r.suggestedRoleIds.join("|"),
      currentRoleIds: r.currentRoleIds.join("|"),
      eligibleRoleIds: (r.eligibleRoleIds ?? []).join("|"),
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const ts = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fname = `entra-review-summary-${ts.getFullYear()}${pad(
      ts.getMonth() + 1
    )}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.csv`;
    downloadBlob(blob, fname);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm text-muted-foreground">
            Time range
          </label>
          <select
            aria-label="time range"
            className="border px-3 py-2 rounded bg-background text-foreground"
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            disabled={loading}
          >
            {timeRanges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={run} disabled={loading || selectedIds.length === 0}>
          {loading ? "Running…" : "Run review"}
        </Button>
        {loading && (
          <span
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Preparing report…
          </span>
        )}
      </div>

      {report && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Report</h3>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={exportJson}
                  disabled={!report}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={exportCsv}
                  disabled={!report}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="sort-by" className="text-foreground/80">
                  Sort by
                </label>
                <select
                  id="sort-by"
                  aria-label="sort by"
                  className="border rounded px-2 py-1 bg-background text-foreground"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as "ops" | "name");
                    setPage(1);
                  }}
                >
                  <option value="ops">Operations</option>
                  <option value="name">User name</option>
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setSortAsc((s) => !s);
                  setPage(1);
                }}
              >
                {sortAsc ? "Asc" : "Desc"}
              </Button>
              <div className="flex items-center gap-1">
                <span>Page</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-foreground"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {"<"}
                </Button>
                <span>{page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-foreground"
                  disabled={page * pageSize >= (report?.length ?? 0)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {">"}
                </Button>
              </div>
              <select
                aria-label="page size"
                className="border rounded px-2 py-1 bg-background text-foreground"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
          <div className="border rounded overflow-hidden bg-card text-card-foreground">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Select</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Operations</th>
                  <th className="text-left p-2">Suggested roles</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.userId} className="border-t align-top">
                    <td className="p-2">
                      <input
                        aria-label={`select ${r.userDisplayName}`}
                        type="checkbox"
                        checked={selection.includes(r.userId)}
                        onChange={() => toggle(r.userId)}
                      />
                    </td>
                    <td className="p-2">{r.userDisplayName}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span>{r.operationCount}</span>
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => setOpenSheetFor(r)}
                        >
                          More details
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">{r.suggestedRoleIds.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Sheet
            open={openSheetFor !== null}
            onOpenChange={(o) => {
              if (!o) setOpenSheetFor(null);
            }}
          >
            {openSheetFor && (
              <SheetContent side="right">
                <SheetHeader>
                  <div className="flex items-center justify-between">
                    <SheetTitle>
                      Operations for {openSheetFor.userDisplayName}
                    </SheetTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setOpenSheetFor(null)}
                      aria-label="Close"
                      title="Close"
                    >
                      Close
                    </Button>
                  </div>
                </SheetHeader>
                <div className="space-y-3 mt-3">
                  {openSheetFor.operations.map((op, idx) => (
                    <div
                      key={idx}
                      className="border rounded p-3 bg-card text-card-foreground"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {op.operation}
                        </div>
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
                            op.permissionDetails &&
                            op.permissionDetails.length > 0
                              ? op.permissionDetails
                              : op.requiredPermissions.map((n) => ({
                                  name: n,
                                  privileged: false,
                                  grantedByRoles: [] as string[],
                                }));
                          if (list.length === 0) {
                            return (
                              <span className="text-muted-foreground">
                                No mapping
                              </span>
                            );
                          }
                          // Build groups by role name
                          const groups = new Map<
                            string,
                            { name: string; privileged: boolean }[]
                          >();
                          const uncovered: {
                            name: string;
                            privileged: boolean;
                          }[] = [];
                          for (const pd of list) {
                            const roles =
                              pd.grantedByRoles && pd.grantedByRoles.length > 0
                                ? pd.grantedByRoles
                                : [];
                            if (roles.length === 0) {
                              uncovered.push({
                                name: pd.name,
                                privileged: pd.privileged,
                              });
                            } else {
                              for (const rn of roles) {
                                const arr = groups.get(rn) ?? [];
                                arr.push({
                                  name: pd.name,
                                  privileged: pd.privileged,
                                });
                                groups.set(rn, arr);
                              }
                            }
                          }
                          const roleSections = Array.from(
                            groups.entries()
                          ).sort(([a], [b]) =>
                            a.localeCompare(b, undefined, {
                              sensitivity: "base",
                            })
                          );
                          return (
                            <div className="space-y-2">
                              {roleSections.map(([roleName, items]) => (
                                <div key={roleName}>
                                  <div className="font-semibold bg-card text-card-foreground mb-1 flex items-center gap-2">
                                    <span>{roleName}</span>
                                    {(() => {
                                      const meta = openSheetFor.roleMeta?.find(
                                        (m) =>
                                          m.name.toLowerCase() ===
                                          roleName.toLowerCase()
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
                                      <span
                                        key={`${roleName}-${i}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border"
                                      >
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
                                  <div className="font-semibold text-foreground mb-1">
                                    Uncovered
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {uncovered.map((it, i) => (
                                      <span
                                        key={`uncovered-${i}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border"
                                      >
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
                      {expanded.has(idx) &&
                        op.targets &&
                        op.targets.length > 0 && (
                          <div className="mt-2 border rounded bg-muted p-2">
                            <div className="font-semibold text-xs mb-1">
                              Targets
                            </div>
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
                                    <div className="font-medium text-[0.8rem]">
                                      {name}
                                    </div>
                                    {meta && (
                                      <div className="text-muted-foreground">
                                        {meta}
                                      </div>
                                    )}
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
          {selection.length > 0 && (
            <div className="mt-2">
              <Button className="bg-emerald-600 hover:bg-emerald-600/90">
                Remediate
              </Button>
            </div>
          )}
        </div>
      )}

      {selection.length > 0 && remediation.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Remediation summary</h3>
          <div className="border rounded p-3 bg-card text-card-foreground">
            {remediation.map((r) => (
              <div key={r.userId} className="py-2 border-b last:border-0">
                <div className="font-medium">{r.userDisplayName}</div>
                <div className="text-sm text-muted-foreground">
                  Suggested: {r.suggestedRoleIds.join(", ") || "No change"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
