import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";

export function ExclusionsTab({
  accessToken,
  apiBase,
}: {
  accessToken: string | null;
  apiBase: string;
}) {
  const [items, setItems] = useState<Array<{ name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(new URL("/api/activity/exclude", apiBase), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const arr: any[] = Array.isArray(json) ? json : [];
      const list = arr
        .map((a) => ({ name: String(a.name ?? a.Name ?? "") }))
        .filter((e) => e.name);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const onExport = useCallback(async () => {
    try {
      const names = items.map((e) => e.name);
      const blob = new Blob([JSON.stringify(names, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "activity-exclusions.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore */
    }
  }, [items]);

  const onImport = useCallback(
    async (file: File) => {
      if (!accessToken) return;
      try {
        const text = await file.text();
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error();
        const current = new Set(items.map((e) => e.name.toLowerCase()));
        const desired = new Set((arr as string[]).map((s) => s.toLowerCase()));
        for (const name of current) {
          if (!desired.has(name)) {
            await fetch(
              new URL(
                `/api/activity/exclude/${encodeURIComponent(name)}`,
                apiBase
              ),
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
          }
        }
        for (const name of desired) {
          if (!current.has(name)) {
            await fetch(new URL("/api/activity/exclude", apiBase), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ activityName: name }),
            });
          }
        }
        void load();
      } catch {
        /* ignore */
      }
    },
    [accessToken, apiBase, items, load]
  );

  const onRemove = useCallback(
    async (name: string) => {
      if (!accessToken) return;
      try {
        const res = await fetch(
          new URL(`/api/activity/exclude/${encodeURIComponent(name)}`, apiBase),
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (res.ok) void load();
      } catch {
        /* ignore */
      }
    },
    [accessToken, apiBase, load]
  );

  return (
    <div className="space-y-3 text-sm max-w-md">
      <p className="text-xs text-muted-foreground">
        Activities in this list are excluded from review output.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={!accessToken}
          onClick={onExport}
        >
          Export
        </Button>
        <div>
          <label className="text-[10px] block font-medium mb-0.5">Import</label>
          <input
            type="file"
            className="text-[10px]"
            accept="application/json,.json"
            disabled={!accessToken}
            aria-label="Import exclusion list JSON file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onImport(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      <div className="border rounded bg-card text-card-foreground divide-y">
        {loading && (
          <div className="p-2 text-xs text-muted-foreground">Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-2 text-xs text-muted-foreground">
            No exclusions.
          </div>
        )}
        {!loading && items.length > 0 && (
          <ul>
            {items.map((e) => (
              <li key={e.name} className="flex items-center gap-2 p-2 text-xs">
                <span className="font-mono break-all flex-1">{e.name}</span>
                <button
                  onClick={() => onRemove(e.name)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="Remove exclusion"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
