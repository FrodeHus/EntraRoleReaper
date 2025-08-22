import { useEffect, useMemo, useState, useRef } from "react";
import { formatISO, subHours, subDays } from "date-fns";
import { Button } from "../components/ui/button";
import { Download, Minus, LogsIcon, Info } from "lucide-react";
import { RoleDetailsSheet } from "./review/RoleDetailsSheet";
import { OperationsSheet } from "./review/OperationsSheet";
import { OperationMappingSheet } from "./review/OperationMappingSheet";
import { RoleChangeDetailsSheet } from "./review/RoleChangeDetailsSheet";
import type {
  ReviewRequest,
  UserReview,
  ReviewResponse,
  RoleDetails,
} from "./review/types";
import { normalizeRoleDetails } from "../lib/normalizeRoleDetails";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { JobQueue } from "./JobQueue";

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
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"ops" | "name">("ops");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [openSheetFor, setOpenSheetFor] = useState<UserReview | null>(null);
  const [openMappingForOp, setOpenMappingForOp] = useState<string | null>(null);
  const [operationHasMapping, setOperationHasMapping] = useState<
    Record<string, boolean>
  >({});
  const [operationMappingCount, setOperationMappingCount] = useState<
    Record<string, number>
  >({});
  const [openRoleChangeFor, setOpenRoleChangeFor] = useState<UserReview | null>(
    null
  );
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
  // Role details cache (id -> details); name-only lookups deprecated now that id always provided
  const roleDetailsCache = useRef<Map<string, RoleDetails>>(new Map());
  // Role changes sheet removed (added/removed shown inline)

  // no-op

  // (moved below after paged definition)

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
    const id = opts.id;
    if (id && roleDetailsCache.current.has(id)) {
      setRoleDetails(roleDetailsCache.current.get(id)!);
      setLoadingRole(false);
      return;
    }
    try {
      if (!id) return; // name-only lookups no longer supported
      const url = new URL(
        `/api/roles/${encodeURIComponent(id)}`,
        import.meta.env.VITE_API_URL
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const details = normalizeRoleDetails(json) as RoleDetails;
      setRoleDetails(details);
      if (id) roleDetailsCache.current.set(id, details);
    } finally {
      setLoadingRole(false);
    }
  };

  const run = async () => {
    if (!accessToken || selectedIds.length === 0) return;
    const payload: ReviewRequest = { usersOrGroups: selectedIds, from, to };
    try {
      setLoading(true);
      setReport(null);
      setJobId(null);
      setJobStatus(null);
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
      const json: any = await res.json();
      const id = json?.id as string | undefined;
      const status = (json?.status as string | undefined) ?? null;
      if (id) {
        setJobId(id);
        setJobStatus(status);
      }
    } finally {
      setLoading(false);
    }
  };

  // Poll job status when we have a job id until completed/failed
  useEffect(() => {
    if (!accessToken || !jobId) return;
    let aborted = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const url = new URL(
          `/api/review/${jobId}/status`,
          import.meta.env.VITE_API_URL
        );
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const s: any = await res.json();
        if (aborted) return;
        const status = (s?.status as string) ?? null;
        setJobStatus(status);
        if (status === "Completed") {
          // fetch result
          const rurl = new URL(
            `/api/review/${jobId}/result`,
            import.meta.env.VITE_API_URL
          );
          const rres = await fetch(rurl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (rres.ok) {
            const raw: any = await rres.json();
            const results: any[] = (raw?.results ??
              raw?.Results ??
              []) as any[];
            const normalized = results.map((r: any) => {
              const activeRoles = Array.isArray(r.activeRoles)
                ? r.activeRoles
                : r.user?.currentActiveRoles ?? [];
              const eligiblePimRoles = Array.isArray(r.eligiblePimRoles)
                ? r.eligiblePimRoles
                : r.user?.currentEligiblePimRoles ?? [];
              return { ...r, activeRoles, eligiblePimRoles };
            }) as unknown as UserReview[];
            setReport(normalized);
          }
          return; // stop polling
        }
        if (status === "Failed" || status === "Cancelled") {
          return; // stop polling
        }
        timer = window.setTimeout(poll, 1500);
      } catch {
        timer = window.setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      aborted = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [accessToken, jobId]);

  // Fetch mapping counts for all operations once report loads (align with current API)
  useEffect(() => {
    if (!accessToken || !report || report.length === 0) return;
    const ops = new Set<string>();
    for (const r of report ?? [])
      for (const o of r.operations ?? [])
        if (o?.operation) ops.add(o.operation);
    if (ops.size === 0) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const existsMap: Record<string, boolean> = {};
        const countMap: Record<string, number> = {};
        // Fetch per operation mapping (current API exposes only this)
        for (const op of ops) {
          try {
            const url = new URL(
              `/api/activity/mapping/${encodeURIComponent(op)}`,
              import.meta.env.VITE_API_URL
            );
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: controller.signal,
            });
            if (!res.ok) continue;
            const json = await res.json();
            const mappedArr: unknown =
              (json && (json.MappedActions ?? json.mapped ?? [])) || [];
            const mappedCount = Array.isArray(mappedArr) ? mappedArr.length : 0;
            existsMap[op] = mappedCount > 0;
            if (mappedCount > 0) countMap[op] = mappedCount;
          } catch {
            // skip per-op errors
          }
        }
        setOperationHasMapping(existsMap);
        setOperationMappingCount(countMap);
      } catch {
        // ignore
      }
    };
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("operation-mappings-updated", listener);
    return () => {
      controller.abort();
      window.removeEventListener("operation-mappings-updated", listener);
    };
  }, [accessToken, report]);

  // Compute required permissions from new contract
  const getRequiredPerms = (r: UserReview): string[] => {
    const set = new Set<string>();
    for (const op of r.operations)
      for (const p of op.permissions) set.add(p.name.toLowerCase());
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
        const aOps = (a.operations ?? []).length;
        const bOps = (b.operations ?? []).length;
        cmp = aOps - bOps;
      } else {
        // Case-insensitive locale compare for user display name
        cmp = a.user.displayName.localeCompare(b.user.displayName, undefined, {
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
    return report.filter((r) => selection.includes(r.user.id));
  }, [report, selection]);

  // Prefetch role display names for active, eligible, added, removed role ids
  useEffect(() => {
    if (!accessToken || !report || paged.length === 0) return;
    const idsToFetch = new Set<string>();
    for (const r of paged) {
      for (const sr of r.activeRoles ?? []) idsToFetch.add(sr.id);
      for (const sr of r.eligiblePimRoles ?? []) idsToFetch.add(sr.id);
      for (const ar of r.addedRoles ?? []) idsToFetch.add(ar.id);
      for (const rr of r.removedRoles ?? []) idsToFetch.add(rr.id);
      for (const op of r.operations)
        for (const p of op.permissions)
          for (const rid of p.grantedByRoleIds) idsToFetch.add(rid);
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
      userId: r.user.id,
      userDisplayName: r.user.displayName,
      activityCount: r.operations.length,
      activeRoleIds: r.activeRoles.map((a) => a.id).join("|"),
      eligiblePimRoleIds: r.eligiblePimRoles.map((a) => a.id).join("|"),
      addedRoleIds: r.addedRoles.map((a) => a.id).join("|"),
      removedRoleIds: r.removedRoles.map((a) => a.id).join("|"),
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

  const computeCounts = (r: UserReview) => ({
    current: (r.activeRoles ?? []).length,
    add: (r.addedRoles ?? []).length,
    remove: (r.removedRoles ?? []).length,
  });

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
        <Button
          onClick={run}
          disabled={
            loading ||
            selectedIds.length === 0 ||
            (!!jobId &&
              !!jobStatus &&
              !["Completed", "Failed", "Cancelled"].includes(jobStatus))
          }
          aria-busy={loading || undefined}
        >
          {loading && (
            <span
              className="inline-block h-4 w-4 mr-2 rounded-full border-2 border-background/40 dark:border-foreground/30 border-t-transparent animate-spin"
              aria-hidden
            />
          )}
          <span>
            {jobId && jobStatus && jobStatus !== "Completed"
              ? `Queued: ${jobStatus}`
              : loading
              ? "Running…"
              : "Run review"}
          </span>
          <span className="sr-only">{loading ? "Preparing report" : ""}</span>
        </Button>
      </div>

      {/* Small job queue widget */}
      <JobQueue
        accessToken={accessToken}
        onOpenResult={async (id) => {
          if (!accessToken) return;
          const url = new URL(
            `/api/review/${id}/result`,
            import.meta.env.VITE_API_URL
          );
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) return;
          const raw: any = await res.json();
          const results: any[] = (raw?.results ?? raw?.Results ?? []) as any[];
          const normalized = results.map((r: any) => {
            const activeRoles = Array.isArray(r.activeRoles)
              ? r.activeRoles
              : r.user?.currentActiveRoles ?? [];
            const eligiblePimRoles = Array.isArray(r.eligiblePimRoles)
              ? r.eligiblePimRoles
              : r.user?.currentEligiblePimRoles ?? [];
            return { ...r, activeRoles, eligiblePimRoles };
          }) as unknown as UserReview[];
          setReport(normalized);
        }}
      />

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
            </div>
          </div>
          <div className="border rounded overflow-hidden bg-card text-card-foreground">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Select
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    User
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Activities
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Active roles
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Eligible roles
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Add
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Remove
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-transparent">
                    Changes
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => {
                  const counts = computeCounts(r);
                  return (
                    <TableRow key={r.user.id} className="align-top">
                      <TableCell>
                        <input
                          aria-label={`select ${r.user.displayName}`}
                          type="checkbox"
                          checked={selection.includes(r.user.id)}
                          onChange={() => toggle(r.user.id)}
                        />
                      </TableCell>
                      <TableCell>{r.user.displayName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{r.operations?.length ?? 0}</span>
                          {(r.operations?.length ?? 0) > 0 && (
                            <Button
                              variant="link"
                              size="icon"
                              className="p-0 h-auto"
                              onClick={() => setOpenSheetFor(r)}
                            >
                              <LogsIcon />
                            </Button>
                          )}
                          {/* Mapping icon now shown per operation inside OperationsSheet */}
                        </div>
                      </TableCell>
                      <TableCell>
                        {counts.current === 0 ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground"
                            title="None"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                            <span className="sr-only">None</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded border border-white-200 text-xs">
                            {counts.current}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(r.eligiblePimRoles?.length ?? 0) === 0 ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground"
                            title="None"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                            <span className="sr-only">None</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-purple-400/10 px-2 py-1 text-xs font-medium text-purple-900 inset-ring-purple-800 dark:text-purple-400 inset-ring dark:inset-ring-purple-400/30">
                            {r.eligiblePimRoles?.length ?? 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {counts.add === 0 ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground"
                            title="None"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                            <span className="sr-only">None</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700">
                            +{counts.add}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {counts.remove === 0 ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground"
                            title="None"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                            <span className="sr-only">None</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/20 dark:border-red-700">
                            -{counts.remove}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="icon"
                          className="p-0 h-auto"
                          onClick={() => setOpenRoleChangeFor(r)}
                          title="Show role change details"
                        >
                          <Info />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
            roleNameLookup={(id) => roleNameCache[id] ?? id}
            openMapping={(op) => setOpenMappingForOp(op)}
            hasMapping={(op) => !!operationHasMapping[op]}
            mappingCount={(op) => operationMappingCount[op]}
            apiBase={import.meta.env.VITE_API_URL}
          />
          <OperationMappingSheet
            operationName={openMappingForOp}
            open={openMappingForOp !== null}
            onOpenChange={(o) => {
              if (!o) setOpenMappingForOp(null);
            }}
            accessToken={accessToken}
            apiBase={import.meta.env.VITE_API_URL}
          />
          <RoleChangeDetailsSheet
            open={openRoleChangeFor !== null}
            onOpenChange={(o) => {
              if (!o) setOpenRoleChangeFor(null);
            }}
            review={openRoleChangeFor}
            roleNameLookup={(id) => roleNameCache[id] ?? id}
            openRoleDetails={openRoleDetails}
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
              <div key={r.user.id} className="py-2 border-b last:border-0">
                <div className="font-medium">{r.user.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  Add:{" "}
                  {r.addedRoles.map((a) => a.displayName).join(", ") || "None"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Remove:{" "}
                  {r.removedRoles.map((a) => a.displayName).join(", ") ||
                    "None"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
