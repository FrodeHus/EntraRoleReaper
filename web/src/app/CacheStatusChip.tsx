import { useEffect, useState } from 'react';
import { Database, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  accessToken: string | null;
  apiBase: string;
}

export function CacheStatusChip({ accessToken, apiBase }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [actionCount, setActionCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // tick to force re-render for relative time without waiting for next fetch
  const [tick, setTick] = useState(0);

  const stale = (() => {
    if (!lastUpdated) return true;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - lastUpdated.getTime() > weekMs;
  })();

  useEffect(() => {
    if (!accessToken) {
      setCount(null);
      setLastUpdated(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(false);
        const url = new URL('/api/cache/status', apiBase);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error('bad');
        const json = await res.json();
        if (cancelled) return;
  setCount(typeof json.roleCount === "number" ? json.roleCount : null);
  setActionCount(
    typeof json.actionCount === "number" ? json.actionCount : null
  );
        setLastUpdated(json.lastUpdatedUtc ? new Date(json.lastUpdatedUtc) : null);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
  return () => {
    cancelled = true;
  };
  }, [accessToken, apiBase]);

  // relative time refresh every 30s so the short label stays current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  function formatRelativeShort(d: Date | null): string | null {
    if (!d) return null;
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return '0s';
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return sec < 5 ? 'now' : `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    const week = Math.floor(day / 7);
    if (week < 4) return `${week}w`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month}mo`;
    const year = Math.floor(day / 365);
    return `${year}y`;
  }

  const displayTime = lastUpdated ? lastUpdated.toLocaleString() : 'n/a';
  const rel = formatRelativeShort(lastUpdated);
  const baseClasses =
    "inline-flex items-center gap-1.5 h-7 px-2 rounded border text-xs font-medium bg-card/60";
  const isUpdated = !loading && !error && !stale && (count ?? 0) > 0;
  const title = error
    ? "Failed to load cache status"
    : `Role cache: ${count ?? "-"} role definitions, ${
        actionCount ?? "-"
      } actions. Last update: ${displayTime}${rel ? ` (${rel} ago)` : ""}${
        stale ? " (stale)" : ""
      }`;

  return (
    <span
      className={baseClasses}
      title={title}
      aria-label={title}
      role="status"
    >
      <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {loading ? (
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent border-muted-foreground animate-spin"
          aria-hidden
        />
      ) : isUpdated ? (
        <CheckCircle2
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
      ) : (
        <XCircle
          className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400"
          aria-hidden
        />
      )}
      <span className="sr-only">Cache status</span>
    </span>
  );
}
