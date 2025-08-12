import { useEffect, useState } from 'react';

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
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
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
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium';
  const variant = loading
    ? 'border-muted-foreground/30 text-muted-foreground'
    : error
      ? 'bg-red-600/10 border-red-600/40 text-red-700 dark:text-red-400'
      : stale || (count ?? 0) === 0
        ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400'
        : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400';
  const title = error
    ? "Failed to load cache status"
    : `Role cache: ${count ?? "-"} role definitions, ${
        actionCount ?? "-"
      } actions. Last update: ${displayTime}${rel ? ` (${rel} ago)` : ""}${
        stale ? " (stale)" : ""
      }`;

  return (
    <span
      className={`${baseClasses} ${variant}`}
      title={title}
      aria-label={title}
      role="status"
    >
      {loading ? (
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent border-current animate-spin"
          aria-hidden
        ></span>
      ) : (
        <span
          className="inline-block h-2 w-2 rounded-full bg-current opacity-70"
          aria-hidden
        ></span>
      )}
      Cache: {count ?? "-"}
      {typeof count === "number" ? " roles" : ""}
      {typeof actionCount === "number" ? ` · ${actionCount} actions` : ""}
      {rel && !loading && !error ? ` · ${rel}` : ""}
      {(stale || (count ?? 0) === 0) && !loading && !error ? "!" : ""}
    </span>
  );
}
