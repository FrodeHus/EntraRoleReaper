import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Progress } from "../components/ui/progress";

type Job = {
  id: string;
  status: string;
  enqueuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  targetCount?: number;
  requestedBy?: string;
  from?: string;
  to?: string;
  userCount?: number | null;
};

export function JobQueue({
  accessToken,
  onOpenResult,
  collapsible = true,
  defaultCollapsed = true,
  title = "Job queue",
  onInProgressChange,
}: {
  accessToken: string | null;
  onOpenResult?: (id: string) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  title?: string;
  onInProgressChange?: (inProgress: boolean) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const url = new URL("/api/review/jobs", import.meta.env.VITE_API_URL);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setJobs(json as Job[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    let timer: number | undefined;
    const tick = async () => {
      await refresh();
      timer = window.setTimeout(tick, 2000);
    };
    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [accessToken]);

  // Notify parent when any job is queued or running
  useEffect(() => {
    const anyInProgress = jobs.some(
      (j) => j.status === "Queued" || j.status === "Running"
    );
    onInProgressChange?.(anyInProgress);
  }, [jobs, onInProgressChange]);

  const canCancel = (j: Job) => j.status === "Queued";

  const cancel = async (id: string) => {
    if (!accessToken) return;
    const url = new URL(
      `/api/review/${id}/cancel`,
      import.meta.env.VITE_API_URL
    );
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) await refresh();
  };

  const sorted = useMemo(() => {
    return [...jobs].sort(
      (a, b) =>
        new Date(b.enqueuedAt).getTime() - new Date(a.enqueuedAt).getTime()
    );
  }, [jobs]);
  const hasInProgress = useMemo(
    () => jobs.some((j) => j.status === "Queued" || j.status === "Running"),
    [jobs]
  );

  if (!accessToken) return null;
  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-muted-foreground">
          {sorted.length} job{sorted.length === 1 ? "" : "s"}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-sm text-muted-foreground">No jobs</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{j.id.slice(0, 8)}</span>
                <span>{j.status}</span>
                {typeof j.targetCount === "number" && (
                  <span className="text-muted-foreground">
                    ({j.targetCount} targets
                    {typeof j.userCount === "number"
                      ? `, ${j.userCount} users`
                      : ""}
                    )
                  </span>
                )}
                {j.requestedBy && (
                  <span className="text-muted-foreground">
                    by {j.requestedBy}
                  </span>
                )}
                {j.from && j.to && (
                  <span className="text-muted-foreground">
                    [{new Date(j.from).toLocaleDateString()} -{" "}
                    {new Date(j.to).toLocaleDateString()}]
                  </span>
                )}
                {j.error && <span className="text-red-600">{j.error}</span>}
              </div>
              <div className="flex items-center gap-2">
                {onOpenResult && j.status === "Completed" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenResult(j.id)}
                  >
                    Open
                  </Button>
                )}
                {canCancel(j) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancel(j.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="border rounded p-2 bg-card text-card-foreground">
      {collapsible ? (
        <Accordion
          type="single"
          collapsible
          defaultValue={defaultCollapsed ? undefined : "jobs"}
        >
          <AccordionItem value="jobs">
            <AccordionTrigger className="px-1">
              <div className="flex items-center justify-between w-full">
                <div className="font-medium">{title}</div>
                <div className="flex-1" />
                {hasInProgress && (
                  <div className="w-32">
                    {/* Indeterminate-style bar via pulse */}
                    <Progress className="h-1 animate-pulse" value={50} />
                  </div>
                )}
                <div className="ml-2 text-xs text-muted-foreground">
                  {sorted.length} job{sorted.length === 1 ? "" : "s"}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 pt-2">{content}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <>
          <div className="font-medium mb-2">{title}</div>
          {content}
        </>
      )}
    </div>
  );
}
