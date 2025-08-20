import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";

export interface MappingItem {
  name: string;
  actions: string[];
  properties: Record<string, string[]>;
}

export function MappingsTab({
  accessToken,
  apiBase,
  onCreate,
  onEditBase,
  onEditProperty,
  onDeleteProperty,
}: {
  accessToken: string | null;
  apiBase: string;
  onCreate: () => void;
  onEditBase: (name: string) => void;
  onEditProperty: (op: string, prop: string) => void;
  onDeleteProperty: (op: string, prop: string) => void;
}) {
  const [items, setItems] = useState<MappingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(new URL("/api/activity/export", apiBase), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const arr: any[] = Array.isArray(json)
        ? json
        : typeof json === "object" && json
        ? Object.values(json as any)
        : [];
      const list = arr.map((it) => {
        const name = String(it.name ?? it.Name ?? "");
        const actions: string[] = Array.isArray(it.mappedResourceActions)
          ? it.mappedResourceActions
          : Array.isArray(it.MappedResourceActions)
          ? it.MappedResourceActions
          : [];
        const props: Record<string, string[]> = (it.properties ??
          it.Properties ??
          {}) as any;
        return { name, actions, properties: props } as MappingItem;
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase]);

  const onExport = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(new URL("/api/activity/export", apiBase), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ts = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      a.download = `activity-mappings-${ts.getFullYear()}${pad(
        ts.getMonth() + 1
      )}${pad(ts.getDate())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore */
    }
  }, [accessToken, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("operation-mappings-updated", handler as any);
    return () =>
      window.removeEventListener("operation-mappings-updated", handler as any);
  }, [load]);

  return (
    <div className="grid gap-4 text-sm">
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={!accessToken}
          onClick={onExport}
        >
          Export activity mappings
        </Button>
        <Button
          className="ml-2"
          size="sm"
          disabled={!accessToken}
          onClick={onCreate}
        >
          Create mapping
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Download current activity and property-level mappings. Legacy
          activities without property mappings export as an array; those with
          properties export an object containing actions and a properties map.
        </p>
      </div>
      {/* Import handled by parent to keep file input state local there */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Current mappings</h3>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || !accessToken}
            onClick={load}
          >
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        </div>
        <div className="border rounded h-[55vh] overflow-auto text-xs divide-y bg-card text-card-foreground">
          {loading && <div className="p-2 text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="p-2 text-muted-foreground">No mappings.</div>
          )}
          {!loading && items.length > 0 && (
            <ul>
              {items.map((m) => {
                const propKeys = Object.keys(m.properties || {});
                const propCount = propKeys.length;
                return (
                  <li key={m.name} className="p-2">
                    <button
                      className="w-full text-left flex items-center gap-2 hover:underline"
                      onClick={() => onEditBase(m.name)}
                      title="Edit base mapping"
                    >
                      <span className="font-mono break-all flex-1">
                        {m.name}
                      </span>
                      <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">
                        actions: {m.actions.length}
                      </span>
                      <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">
                        properties: {propCount}
                      </span>
                    </button>
                    {propCount > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {propKeys.slice(0, 20).map((p) => (
                          <div
                            key={`${m.name}::${p}`}
                            className="inline-flex items-center gap-1"
                          >
                            <button
                              className="px-1.5 py-0.5 border rounded bg-muted hover:bg-muted/70"
                              title={`Edit property mapping: ${m.name}::${p}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProperty(m.name, p);
                              }}
                            >
                              <span className="font-mono">{p}</span>
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {m.properties?.[p]?.length ?? 0}
                              </span>
                            </button>
                            <button
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title={`Delete ${m.name}::${p}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProperty(m.name, p);
                              }}
                            >
                              🗑
                            </button>
                          </div>
                        ))}
                        {propKeys.length > 20 && (
                          <span className="text-[10px] text-muted-foreground">
                            …
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
