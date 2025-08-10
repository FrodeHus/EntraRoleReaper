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
import { RoleDetailsSheet } from "./review/RoleDetailsSheet";
import type {
  ReviewRequest,
  UserReview,
  ReviewResponse,
  RoleDetails,
} from "./review/types";
import { OperationsSheet } from "./review/OperationsSheet";
import { SuggestedRolesCell } from "./review/SuggestedRolesCell";

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
  // Cache of role id -> display name for removal chips
  const [roleNameCache, setRoleNameCache] = useState<Record<string, string>>(
    {}
  );
  // Role details sheet state
  const [openRole, setOpenRole] = useState<{
    id?: string;
    name: string;
    requiredPerms: string[];
  } | null>(null);
  const [roleDetails, setRoleDetails] = useState<RoleDetails>(null);
  const [loadingRole, setLoadingRole] = useState<boolean>(false);

  useEffect(() => {
    // Reset expanded state when switching user/sheet
    setExpanded(new Set());
  }, [openSheetFor]);

  // no-op

  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const isGuid = (s: string) =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      s
    );

  // Fetch and cache role display names for a set of role ids
  const ensureRoleNames = async (ids: string[]) => {
    if (!accessToken) return;
    const missing = ids.filter((id) => isGuid(id) && !roleNameCache[id]);
    if (missing.length === 0) return;
    try {
      const url = new URL("/api/roles/names", import.meta.env.VITE_API_URL);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(missing),
      });
      if (!res.ok) return;
      const arr = (await res.json()) as { id: string; name: string }[];
      const map: Record<string, string> = {};
      for (const { id, name } of arr) if (name) map[id] = name;
      if (Object.keys(map).length > 0)
        setRoleNameCache((prev) => ({ ...prev, ...map }));
    } catch {
      // ignore
    }
  };

  const openRoleDetails = async (opts: {
    id?: string;
    name: string;
    requiredPerms: string[];
  }) => {
    if (!accessToken) return;
    setOpenRole({
      id: opts.id,
      name: opts.name,
      requiredPerms: opts.requiredPerms,
    });
    setRoleDetails(null);
    setLoadingRole(true);
    try {
      const url = new URL("/api/role", import.meta.env.VITE_API_URL);
      if (opts.id && opts.id.length > 0) {
        url.searchParams.set("id", opts.id);
      } else {
        url.searchParams.set("name", opts.name);
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setRoleDetails(json as RoleDetails);
    } finally {
      setLoadingRole(false);
    }
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

  // Compute the set of required permission actions for a given user review
  const getRequiredPerms = (r: UserReview): string[] => {
    const set = new Set<string>();
    for (const op of r.operations) {
      if (op.permissionDetails && op.permissionDetails.length > 0) {
        for (const pd of op.permissionDetails) set.add(pd.name.toLowerCase());
      } else {
        for (const n of op.requiredPermissions) set.add(n.toLowerCase());
      }
    }
    return Array.from(set);
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

  // Prefetch removal role names for visible rows
  useEffect(() => {
    if (!accessToken || !report || paged.length === 0) return;
    const idsToFetch = new Set<string>();
    for (const r of paged) {
      // Prefer suggestedRoles with ids
      const suggestIds = (r.suggestedRoles ?? [])
        .map((sr) => (sr as any).id as string | undefined)
        .filter((x): x is string => !!x);
      let suggestedIdSet = new Set<string>(suggestIds);
      // Fallback to suggestedRoleIds that are GUIDs
      if (suggestedIdSet.size === 0) {
        const legacyIds = (r.suggestedRoleIds ?? []).filter((s) => isGuid(s));
        suggestedIdSet = new Set<string>(legacyIds);
      }
      if (suggestedIdSet.size === 0) continue;
      for (const id of r.currentRoleIds) {
        if (!suggestedIdSet.has(id)) idsToFetch.add(id);
      }
    }
    void ensureRoleNames(Array.from(idsToFetch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, paged]);

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
                    <td className="p-2">
                      <SuggestedRolesCell
                        review={r}
                        getRequiredPerms={getRequiredPerms}
                        openRoleDetails={openRoleDetails}
                        roleNameCache={roleNameCache}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Role details sheet (refactored) */}
          <RoleDetailsSheet
            open={openRole !== null}
            onOpenChange={(o) => {
              if (!o) {
                setOpenRole(null);
                setRoleDetails(null);
              }
            }}
            role={
              openRole
                ? { name: openRole.name, requiredPerms: openRole.requiredPerms }
                : null
            }
            details={roleDetails}
            loading={loadingRole}
          />
          <OperationsSheet
            open={openSheetFor !== null}
            onOpenChange={(o) => {
              if (!o) setOpenSheetFor(null);
            }}
            review={openSheetFor}
          />
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
