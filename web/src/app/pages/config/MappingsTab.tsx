import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

export interface MappingItem {
  name: string;
  category: string;
  service: string;
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
  const [search, setSearch] = useState("");
  const [mappedOnly, setMappedOnly] = useState(false);
  // Optional metadata lookup map: name -> { category, service }
  const [meta, setMeta] = useState<
    Record<string, { category?: string; service?: string }>
  >({});

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
        const category = String(it.category ?? "").trim();
        const service = String(it.service ?? "").trim();
        const actions: string[] = Array.isArray(it.mappedResourceActions)
          ? it.mappedResourceActions
          : Array.isArray(it.MappedResourceActions)
          ? it.MappedResourceActions
          : [];
        const props: Record<string, string[]> = (it.properties ??
          it.Properties ??
          {}) as any;
        return {
          name,
          category,
          service,
          actions,
          properties: props,
        } as MappingItem;
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
        <div className="mt-2 flex items-center gap-3 max-w-xl">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search activities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mapped only</span>
            <Switch
              checked={mappedOnly}
              onCheckedChange={(v) => setMappedOnly(Boolean(v))}
              disabled={!accessToken}
              aria-label="Show only activities that have mappings"
            />
          </div>
        </div>
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
        <div className="border rounded h-[55vh] overflow-auto bg-card text-card-foreground">
          {loading && (
            <div className="p-2 text-muted-foreground text-xs">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-2 text-muted-foreground text-xs">
              No mappings.
            </div>
          )}
          {!loading && items.length > 0 && (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Activity</TableHead>
                  <TableHead className="w-[20%]">Audit Category</TableHead>
                  <TableHead className="w-[20%]">Service</TableHead>
                  <TableHead className="w-[15%]">Map count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .filter((m) =>
                    search.trim()
                      ? m.name.toLowerCase().includes(search.toLowerCase())
                      : true
                  )
                  .filter((m) => {
                    if (!mappedOnly) return true;
                    const base = m.actions.length;
                    const props = Object.keys(m.properties || {}).reduce(
                      (acc, k) => acc + (m.properties?.[k]?.length ?? 0),
                      0
                    );
                    return base + props > 0;
                  })
                  .map((m) => {
                    const propKeys = Object.keys(m.properties || {});
                    const baseCount = m.actions.length;
                    const propMapCount = propKeys.reduce(
                      (acc, k) => acc + (m.properties?.[k]?.length ?? 0),
                      0
                    );
                    const totalCount = baseCount + propMapCount;
                    return (
                      <TableRow
                        key={m.name}
                        className="cursor-pointer"
                        onClick={() => onEditBase(m.name)}
                        title="Edit base mapping"
                      >
                        <TableCell className="font-mono break-all">
                          {m.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.category ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.service ?? "-"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1 rounded border bg-muted text-muted-foreground">
                              {totalCount}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({baseCount} base, {propMapCount} props)
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
          {!loading &&
            items.length > 0 &&
            items.filter(
              (m) =>
                (search.trim()
                  ? m.name.toLowerCase().includes(search.toLowerCase())
                  : true) &&
                (!mappedOnly ||
                  m.actions.length +
                    Object.keys(m.properties || {}).reduce(
                      (acc, k) => acc + (m.properties?.[k]?.length ?? 0),
                      0
                    ) >
                    0)
            ).length === 0 && (
              <div className="p-2 text-muted-foreground text-xs">
                No matching mappings.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
