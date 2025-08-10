import { useEffect, useMemo, useState } from "react";
import { addDays, formatISO } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

export type ReviewRequest = {
  usersOrGroups: string[];
  from: string;
  to: string;
};

type UserReview = {
  userId: string;
  userDisplayName: string;
  currentRoleIds: string[];
  usedOperations: string[];
  suggestedRoleIds: string[];
  operationCount: number;
  operations: {
    operation: string;
    requiredPermissions: string[];
    targets: {
      id?: string;
      displayName?: string;
      type?: string;
      label?: string;
    }[];
    permissionDetails?: { name: string; privileged: boolean }[];
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
  const [from, setFrom] = useState<string>(formatISO(addDays(new Date(), -30)));
  const [to, setTo] = useState<string>(formatISO(new Date()));
  const [report, setReport] = useState<UserReview[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"ops" | "name">("ops");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [openSheetFor, setOpenSheetFor] = useState<UserReview | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm text-gray-600">From</label>
          <input
            aria-label="from"
            type="datetime-local"
            value={from.substring(0, 16)}
            onChange={(e) => setFrom(new Date(e.target.value).toISOString())}
            className="border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">To</label>
          <input
            aria-label="to"
            type="datetime-local"
            value={to.substring(0, 16)}
            onChange={(e) => setTo(new Date(e.target.value).toISOString())}
            className="border px-3 py-2 rounded"
          />
        </div>
        <button
          onClick={run}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Run review
        </button>
      </div>

      {report && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Report</h3>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <label htmlFor="sort-by" className="text-gray-700">
                  Sort by
                </label>
                <select
                  id="sort-by"
                  aria-label="sort by"
                  className="border rounded px-2 py-1"
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
              <button
                className="px-2 py-1 border rounded"
                onClick={() => {
                  setSortAsc((s) => !s);
                  setPage(1);
                }}
              >
                {sortAsc ? "Asc" : "Desc"}
              </button>
              <div className="flex items-center gap-1">
                <span>Page</span>
                <button
                  className="px-2 border rounded"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {"<"}
                </button>
                <span>{page}</span>
                <button
                  className="px-2 border rounded"
                  disabled={page * pageSize >= (report?.length ?? 0)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {">"}
                </button>
              </div>
              <select
                aria-label="page size"
                className="border rounded px-2 py-1"
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
          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
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
                        <button
                          className="text-blue-600"
                          onClick={() => setOpenSheetFor(r)}
                        >
                          More details
                        </button>
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
                  <SheetTitle>
                    Operations for {openSheetFor.userDisplayName}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  <ul className="pl-4">
                    {openSheetFor.operations.map((op, idx) => (
                      <li key={idx} className="mb-2 list-disc">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{op.operation}</div>
                          {op.targets && op.targets.length > 0 && (
                            <button
                              className="text-blue-600 text-xs"
                              onClick={() => toggleExpanded(idx)}
                            >
                              {expanded.has(idx) ? "Hide details" : "Details"}
                            </button>
                          )}
                        </div>
                        <div className="text-gray-700 text-xs flex flex-wrap gap-2">
                          {(op.permissionDetails &&
                          op.permissionDetails.length > 0
                            ? op.permissionDetails
                            : op.requiredPermissions.map((n) => ({
                                name: n,
                                privileged: false,
                              }))
                          ).map((pd, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border"
                            >
                              <span>{pd.name}</span>
                              {pd.privileged && (
                                <span className="text-red-700 bg-red-50 border border-red-200 rounded px-1 text-[10px]">
                                  Privileged
                                </span>
                              )}
                            </span>
                          ))}
                          {(!op.permissionDetails ||
                            op.permissionDetails.length === 0) &&
                            op.requiredPermissions.length === 0 && (
                              <span className="text-gray-500">No mapping</span>
                            )}
                        </div>
                        {expanded.has(idx) &&
                          op.targets &&
                          op.targets.length > 0 && (
                            <div className="mt-2 border rounded bg-gray-50 p-2">
                              <div className="font-semibold text-xs mb-1">
                                Targets
                              </div>
                              <ul className="list-disc pl-4 text-xs">
                                {op.targets.map((t, i2) => {
                                  const name =
                                    t.displayName || t.id || "Unknown";
                                  const metaParts: string[] = [];
                                  if (t.label) metaParts.push(t.label);
                                  else if (t.type) metaParts.push(t.type);
                                  if (t.id) metaParts.push(t.id);
                                  const meta = metaParts.join(" • ");
                                  return (
                                    <li key={i2}>
                                      <div className="font-medium text-[0.8rem]">
                                        {name}
                                      </div>
                                      {meta && (
                                        <div className="text-gray-600">
                                          {meta}
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                      </li>
                    ))}
                  </ul>
                </div>
              </SheetContent>
            )}
          </Sheet>
          {selection.length > 0 && (
            <div className="mt-2">
              <button className="px-4 py-2 bg-emerald-600 text-white rounded">
                Remediate
              </button>
            </div>
          )}
        </div>
      )}

      {selection.length > 0 && remediation.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Remediation summary</h3>
          <div className="border rounded p-3">
            {remediation.map((r) => (
              <div key={r.userId} className="py-2 border-b last:border-0">
                <div className="font-medium">{r.userDisplayName}</div>
                <div className="text-sm text-gray-600">
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
