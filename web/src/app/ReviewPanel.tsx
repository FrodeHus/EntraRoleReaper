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
import { Progress } from "../components/ui/progress";

export function ReviewPanel({
  accessToken,
  selectedIds,
}: {
  accessToken: string | null;
  selectedIds: string[];
}) {
  const [openActivitiesFor, setOpenActivitiesFor] = useState<any | null>(null);
  const [openRolesFor, setOpenRolesFor] = useState<any | null>(null);
  // Time range selection
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
  const from =
    timeRanges.find((r) => r.value === selectedRange)?.getFrom() ??
    timeRanges[timeRanges.length - 1].getFrom();

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [queueInProgress, setQueueInProgress] = useState<boolean>(false);
  const [reviewResult, setReviewResult] = useState<any | null>(null);

  // Job submission
  const run = async () => {
    if (!accessToken || selectedIds.length === 0) return;
    const payload = { usersOrGroups: selectedIds, from, to };
    try {
      setLoading(true);
      setReviewResult(null);
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

  // Poll job status and fetch result
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
            setReviewResult(raw);
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
  // ...existing code...
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-sm text-muted-foreground">
            Time range
          </label>
          <select
            title="Time range"
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
          disabled={loading || selectedIds.length === 0}
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

      {/* Small job queue widget (always visible) */}
      <div className="relative">
        {/* Inline progress bar when any job is queued or running */}
        {queueInProgress && (
          <div className="absolute left-0 right-0 -top-2">
            <Progress value={undefined as any} />
          </div>
        )}
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
            setReviewResult(raw);
          }}
          onInProgressChange={setQueueInProgress}
        />
      </div>

      {reviewResult && reviewResult.results && (
        <div className="space-y-3">
          <h3 className="font-semibold">Review Result</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Suggested Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewResult.results.map((userReview: any, idx: number) => {
                const user = userReview.user;
                const activitiesCount = userReview.operations?.length ?? 0;
                const rolesCount = [
                  ...(userReview.activeRoles ?? []),
                  ...(userReview.eligiblePimRoles ?? []),
                  ...(userReview.pimRoles ?? []),
                  ...(userReview.otherRoles ?? []),
                ].length;
                const suggested = userReview.suggestedRoles ?? [];
                return (
                  <TableRow key={user?.id ?? idx}>
                    <TableCell>
                      {user?.displayName ?? user?.id ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {activitiesCount}
                      {activitiesCount > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="ml-2 px-2 py-0 h-auto"
                          onClick={() => setOpenActivitiesFor(userReview)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {rolesCount}
                      {rolesCount > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="ml-2 px-2 py-0 h-auto"
                          onClick={() => setOpenRolesFor(userReview)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {suggested.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        suggested.map((role: any, i: number) => (
                          <span
                            key={i}
                            className="inline-block bg-muted/30 rounded px-2 py-0.5 mr-1 text-xs"
                          >
                            {role.name}
                          </span>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Activities Sheet */}
          <OperationsSheet
            open={!!openActivitiesFor}
            onOpenChange={(o) => {
              if (!o) setOpenActivitiesFor(null);
            }}
            review={openActivitiesFor}
            roleNameLookup={(id) => id}
            openMapping={() => {}}
            hasMapping={() => false}
            mappingCount={() => 0}
            apiBase={import.meta.env.VITE_API_URL}
          />
          {/* Roles Sheet */}
          <RoleDetailsSheet
            open={!!openRolesFor}
            onOpenChange={(o) => {
              if (!o) setOpenRolesFor(null);
            }}
            role={
              openRolesFor
                ? {
                    name: openRolesFor.user?.displayName ?? "",
                    requiredPerms: [],
                  }
                : null
            }
            details={null}
            loading={false}
          />
        </div>
      )}
    </div>
  );
}
