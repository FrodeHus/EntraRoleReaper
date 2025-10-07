import { useEffect, useMemo, useState, useRef } from "react";
import { formatISO, subHours, subDays } from "date-fns";
import { Button } from "../components/ui/button";
import { Download, Minus, LogsIcon, Info } from "lucide-react";
import { Suspense, lazy } from "react";
const RoleDetailsSheet = lazy(() =>
  import("./review/RoleDetailsSheet").then((m) => ({
    default: m.RoleDetailsSheet,
  }))
);
const ActivitiesSheet = lazy(() =>
  import("./review/ActivitiesSheet").then((m) => ({
    default: m.ActivitiesSheet,
  }))
);
const OperationMappingSheet = lazy(() =>
  import("./review/OperationMappingSheet").then((m) => ({
    default: m.OperationMappingSheet,
  }))
);
import { RoleChangeDetailsSheet } from "./review/RoleChangeDetailsSheet";
import { ScoreSheet } from "./review/ScoreSheet";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function ReviewPanel({
  accessToken,
  selectedIds,
}: {
  accessToken: string | null;
  selectedIds: string[];
}) {
  const headerControlsRef = useRef<HTMLDivElement | null>(null);
  const [openActivitiesFor, setOpenActivitiesFor] = useState<any | null>(null);
  const [openRolesFor, setOpenRolesFor] = useState<any | null>(null);
  const [openScoreSheet, setOpenScoreSheet] = useState(false);
  const [selectedEvaluationResult, setSelectedEvaluationResult] = useState<
    any | null
  >(null);
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
      <div ref={headerControlsRef} className="flex items-end gap-2">
        <div>
          <label className="block text-sm text-muted-foreground">
            Time range
          </label>
          <Select
            value={selectedRange}
            onValueChange={(v: string) => setSelectedRange(v)}
            disabled={loading}
          >
            <SelectTrigger className="mt-1 w-48" aria-label="Time range">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent container={headerControlsRef.current}>
              {timeRanges.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead>Suggested Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewResult.results.map((userReview: any, idx: number) => {
                const user = userReview.user ?? userReview.User ?? userReview;
                // Activities: activityResults array, each item has "activity"
                const activityResults = userReview.activityResults ?? [];
                const activitiesCount = Array.isArray(activityResults)
                  ? activityResults.length
                  : 0;
                // Roles: sum of activeRoleIds, eligibleRoleIds, pimActiveRoleIds in user object
                const activeRoleIds = Array.isArray(user?.activeRoleIds)
                  ? user.activeRoleIds.length
                  : 0;
                const eligibleRoleIds = Array.isArray(user?.eligibleRoleIds)
                  ? user.eligibleRoleIds.length
                  : 0;
                const pimActiveRoleIds = Array.isArray(user?.pimActiveRoleIds)
                  ? user.pimActiveRoleIds.length
                  : 0;
                const rolesCount =
                  activeRoleIds + eligibleRoleIds + pimActiveRoleIds;
                // Suggested roles: collect all activityResults[*].evaluationResult.roleDefinition
                // Collect suggested roles and their evaluationResults
                const suggestedRoles = Array.isArray(activityResults)
                  ? activityResults
                      .map((ar: any) => ({
                        role: ar.evaluationResult?.roleDefinition,
                        evaluationResult: ar.evaluationResult,
                      }))
                      .filter((rd: any) => !!rd.role)
                  : [];
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
                      {activitiesCount === 0 && (
                        <span className="text-muted-foreground ml-2">
                          No activities
                        </span>
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
                      {rolesCount === 0 && (
                        <span className="text-muted-foreground ml-2">
                          No roles
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {suggestedRoles.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        suggestedRoles.map((item: any, i: number) => (
                          <button
                            key={i}
                            className="inline-block bg-muted/30 rounded px-2 py-0.5 mr-1 text-xs hover:bg-muted/50 transition"
                            onClick={() => {
                              setSelectedEvaluationResult(
                                item.evaluationResult
                              );
                              setOpenScoreSheet(true);
                            }}
                            type="button"
                          >
                            {item.role.displayName ??
                              item.role.name ??
                              item.role.id ??
                              "Unknown"}
                          </button>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Activities Sheet */}
          <Suspense fallback={null}>
            <ActivitiesSheet
              open={!!openActivitiesFor}
              onOpenChange={(o) => {
                if (!o) setOpenActivitiesFor(null);
              }}
              review={openActivitiesFor}
            />
          </Suspense>

          {/* Roles Sheet */}
          <Suspense fallback={null}>
            <RoleDetailsSheet
              open={!!openRolesFor}
              onOpenChange={(o) => {
                if (!o) setOpenRolesFor(null);
              }}
              role={
                openRolesFor
                  ? {
                      name: openRolesFor.user?.displayName ?? "",
                      requiredPerms: [
                        ...(openRolesFor.user?.activeRoleIds ?? []),
                        ...(openRolesFor.user?.eligibleRoleIds ?? []),
                        ...(openRolesFor.user?.pimActiveRoleIds ?? []),
                      ],
                    }
                  : null
              }
              details={openRolesFor?.user ?? null}
              loading={false}
            />
          </Suspense>
          {/* Score Sheet for suggested roles */}
          <ScoreSheet
            open={openScoreSheet}
            onOpenChange={(o: boolean) => {
              setOpenScoreSheet(o);
              if (!o) setSelectedEvaluationResult(null);
            }}
            evaluationResult={selectedEvaluationResult}
          />
        </div>
      )}
    </div>
  );
}
