import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { RefreshCw } from "lucide-react";

interface MappingAction {
  id: string; // Guid
  action: string;
  isPrivileged: boolean;
}
interface MappingData {
  operationName: string;
  exists: boolean;
  mapped: MappingAction[];
  all: MappingAction[];
}

export function OperationMappingSheet({
  operationName,
  open,
  onOpenChange,
  accessToken,
  apiBase,
}: {
  operationName: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accessToken: string | null;
  apiBase: string;
}) {
  const [data, setData] = useState<MappingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(
    new Set()
  );
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showMappedOnly, setShowMappedOnly] = useState(true);

  // Parse composite token operation::property (property optional)
  const parsed = useMemo(() => {
    if (!operationName)
      return { op: null as string | null, prop: null as string | null };
    const parts = operationName.split("::");
    if (parts.length === 2) return { op: parts[0], prop: parts[1] };
    return { op: operationName, prop: null as string | null };
  }, [operationName]);

  const load = useCallback(async () => {
    if (!parsed.op || !accessToken) return;
    try {
      setLoading(true);
      setError(null);
      if (parsed.prop) {
        // Property-level: there is no GET in this UI; fetch base mapping to get the 'all' list and start with none mapped.
        const baseUrl = new URL(
          `/api/operations/map/${encodeURIComponent(parsed.op)}`,
          apiBase
        );
        const baseRes = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!baseRes.ok) throw new Error("Failed to load base mapping");
        const baseJson = (await baseRes.json()) as any;
        const merged: MappingData = {
          operationName: `${parsed.op}::${parsed.prop}`,
          exists: true,
          mapped: [],
          all: Array.isArray(baseJson.all)
            ? (baseJson.all as MappingAction[])
            : [],
        };
        setData(merged);
        setSelected(new Set<string>());
        setOriginalSelected(new Set<string>());
      } else {
        const url = new URL(
          `/api/operations/map/${encodeURIComponent(parsed.op)}`,
          apiBase
        );
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load mapping");
        const json = (await res.json()) as any;
        // Normalize 'all' items to { id, action, isPrivileged } regardless of casing
        const rawAll: any[] = Array.isArray(json.all) ? json.all : [];
        const all: MappingAction[] = rawAll.map((a) => ({
          id: String(a.id ?? a.Id ?? a.ID),
          action: String(a.action ?? a.Action),
          isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
        }));
        // 'mapped' comes back as an array of action names (strings)
        const mappedNames: string[] = Array.isArray(json.mapped)
          ? (json.mapped as any[]).map((m) => String(m))
          : [];
        const selectedIds = new Set<string>(
          all
            .filter((a) =>
              mappedNames.some(
                (n) => n.toLowerCase() === a.action.toLowerCase()
              )
            )
            .map((a) => a.id)
            .map(String)
        );
        const mappedObjs: MappingAction[] = all.filter((a) =>
          selectedIds.has(String(a.id))
        );
        const dataObj: MappingData = {
          operationName: parsed.op,
          exists: mappedObjs.length > 0,
          mapped: mappedObjs,
          all,
        };
        setData(dataObj);
        setSelected(new Set<string>(Array.from(selectedIds)));
        setOriginalSelected(new Set<string>(Array.from(selectedIds)));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [parsed, accessToken, apiBase]);

  useEffect(() => {
    if (open) {
      setShowMappedOnly(true); // default on each open
      load();
    } else {
      setData(null);
      setSelected(new Set());
      setOriginalSelected(new Set());
      setFilter("");
      setError(null);
    }
  }, [open, load]);

  // Remote search has been removed; backend returns complete 'all' list.

  // Debounce filter input to reduce fetch frequency
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedFilter(filter), 300);
    return () => clearTimeout(handle);
  }, [filter]);

  // Client-side filter only

  const combinedList = useMemo(() => {
    if (!data) return [] as MappingAction[];
    let list = data.all.slice();
    // Keep deterministic order: mapped first, then action name
    const sel = selected;
    list.sort((a, b) => {
      const aMapped = sel.has(a.id) ? 0 : 1;
      const bMapped = sel.has(b.id) ? 0 : 1;
      if (aMapped !== bMapped) return aMapped - bMapped;
      return a.action.localeCompare(b.action);
    });
    const term = debouncedFilter.trim().toLowerCase();
    if (showMappedOnly) {
      const sel = selected;
      list = list.filter((a) => sel.has(a.id));
    }
    if (term) list = list.filter((a) => a.action.toLowerCase().includes(term));
    return list;
  }, [data, debouncedFilter, showMappedOnly, selected]);

  // Highlight helper
  const highlight = useCallback(
    (text: string) => {
      const term = debouncedFilter.trim();
      if (!term) return text;
      try {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${escaped})`, "ig");
        const parts = text.split(regex);
        return parts.map((part, i) =>
          regex.test(part) ? (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        );
      } catch {
        return text; // fallback if regex fails
      }
    },
    [debouncedFilter]
  );

  const mappedIds = useMemo(
    () => new Set(data?.mapped.map((m) => m.id) ?? []),
    [data]
  );

  const save = useCallback(
    async (next: Set<string>) => {
      if (!parsed.op || !accessToken) return;
      try {
        setSaving(true);
        // Backend expects Guid[] (array of UUID strings)
        const bodyArr = Array.from(next);
        let saved: MappingData | null = null;
        if (parsed.prop) {
          const url = new URL(
            `/api/operations/map/${encodeURIComponent(
              parsed.op
            )}/properties/${encodeURIComponent(parsed.prop)}`,
            apiBase
          );
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyArr),
          });
          if (!res.ok) throw new Error("Failed to save property mapping");
          // After save, reload to get authoritative list
          await load();
          saved = null; // load handles state
        } else {
          const url = new URL(
            `/api/operations/map/${encodeURIComponent(parsed.op)}`,
            apiBase
          );
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyArr),
          });
          if (!res.ok) throw new Error("Failed to save mapping");
          // No body returned; refresh from GET to reflect saved state
          await load();
          saved = null;
        }
        const mappedLen =
          saved && (saved as any).mapped
            ? (saved as any).mapped.length
            : next.size;
        toast.success("Mapping saved", {
          description: `${mappedLen} actions mapped`,
        });
        window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
      } catch (e: any) {
        setError(e.message || "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [parsed, accessToken, apiBase, load]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    if (selected.size !== originalSelected.size) return true;
    for (const id of selected) if (!originalSelected.has(id)) return true;
    return false;
  }, [selected, originalSelected]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>
                <span className="flex items-center gap-2">
                  Operation Mapping
                  {operationName && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {operationName}
                    </span>
                  )}
                </span>
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={load}
                  title="Refresh mapping"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasChanges || saving}
                  onClick={() => save(selected)}
                  title={
                    hasChanges
                      ? saving
                        ? "Saving..."
                        : "Save mapping"
                      : "No changes"
                  }
                  className={
                    hasChanges
                      ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                      : ""
                  }
                >
                  {saving && (
                    <span
                      className="inline-block h-3 w-3 mr-1 align-middle rounded-full border-2 border-current border-t-transparent animate-spin"
                      aria-hidden
                    />
                  )}
                  <span>{saving ? "Saving" : "Save"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            {error && <div className="text-red-600 text-xs">{error}</div>}
            {data && (
              <div className="flex items-center gap-2">
                <input
                  placeholder="Filter actions"
                  className="border rounded px-2 py-1 text-xs w-full bg-background"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <Button
                  variant={showMappedOnly ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowMappedOnly((s) => !s)}
                  title="Toggle showing only currently mapped actions"
                >
                  {showMappedOnly ? "Mapped only" : "All"}
                </Button>
                {filter && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilter("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
            <div className="border rounded h-[60vh] overflow-auto p-2 bg-card text-card-foreground">
              {loading && (
                <div className="text-xs text-muted-foreground">Loading...</div>
              )}
              {!loading && data && combinedList.length === 0 && (
                <div className="text-xs text-muted-foreground">No actions.</div>
              )}
              {!loading && data && combinedList.length > 0 && (
                <ul className="space-y-1">
                  {combinedList.map((a) => {
                    const checked = selected.has(a.id);
                    const originallyMapped = mappedIds.has(a.id);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(a.id)}
                          aria-label={`Map ${a.action}`}
                        />
                        <span
                          className={`flex-1 font-mono ${
                            checked ? "" : "text-muted-foreground"
                          }`}
                        >
                          {highlight(a.action)}
                        </span>
                        {a.isPrivileged && (
                          <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            priv
                          </span>
                        )}
                        {originallyMapped && !checked && (
                          <span className="text-[10px] text-red-600">
                            removed
                          </span>
                        )}
                        {!originallyMapped && checked && (
                          <span className="text-[10px] text-emerald-600">
                            added
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {saving && (
              <div className="text-[10px] text-muted-foreground">Saving...</div>
            )}
            {hasChanges && !saving && (
              <div className="text-[10px] text-amber-600">Unsaved changes</div>
            )}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
