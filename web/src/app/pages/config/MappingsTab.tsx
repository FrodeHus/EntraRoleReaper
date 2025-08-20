import { useEffect } from "react";
import { Button } from "../../../components/ui/button";

export interface MappingItem {
  name: string;
  actions: string[];
  properties: Record<string, string[]>;
}

export function MappingsTab({
  accessToken,
  apiBase,
  items,
  loading,
  onRefresh,
  onExport,
  onCreate,
  onEditBase,
  onEditProperty,
  onDeleteProperty,
}: {
  accessToken: string | null;
  apiBase: string;
  items: MappingItem[];
  loading: boolean;
  onRefresh: () => void;
  onExport: () => Promise<void>;
  onCreate: () => void;
  onEditBase: (name: string) => void;
  onEditProperty: (op: string, prop: string) => void;
  onDeleteProperty: (op: string, prop: string) => void;
}) {
  useEffect(() => {
    // placeholder to keep file a module; no-op
  }, []);

  return (
    <div className="grid gap-4 text-sm">
      <div>
        <Button variant="outline" size="sm" disabled={!accessToken} onClick={onExport}>
          Export activity mappings
        </Button>
        <Button className="ml-2" size="sm" disabled={!accessToken} onClick={onCreate}>
          Create mapping
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Download current activity and property-level mappings. Legacy activities without property mappings export as an array; those with properties export an object containing actions and a properties map.
        </p>
      </div>
      {/* Import handled by parent to keep file input state local there */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Current mappings</h3>
          <Button variant="ghost" size="sm" disabled={loading || !accessToken} onClick={onRefresh}>
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        </div>
        <div className="border rounded h-[55vh] overflow-auto text-xs divide-y bg-card text-card-foreground">
          {loading && <div className="p-2 text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && <div className="p-2 text-muted-foreground">No mappings.</div>}
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
                      <span className="font-mono break-all flex-1">{m.name}</span>
                      <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">actions: {m.actions.length}</span>
                      <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">properties: {propCount}</span>
                    </button>
                    {propCount > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {propKeys.slice(0, 20).map((p) => (
                          <div key={`${m.name}::${p}`} className="inline-flex items-center gap-1">
                            <button
                              className="px-1.5 py-0.5 border rounded bg-muted hover:bg-muted/70"
                              title={`Edit property mapping: ${m.name}::${p}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditProperty(m.name, p);
                              }}
                            >
                              <span className="font-mono">{p}</span>
                              <span className="ml-1 text-[10px] text-muted-foreground">{m.properties?.[p]?.length ?? 0}</span>
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
                        {propKeys.length > 20 && <span className="text-[10px] text-muted-foreground">…</span>}
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
