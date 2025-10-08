import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { RefreshCw } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import ResourceActionList from "@/components/ResourceActionList";

interface MappingAction {
  id: string; // Guid
  action: string;
  isPrivileged: boolean;
  description?: string;
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
  // ResourceActionList provides built-in search; remove local text filter
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
        // Property-level: fetch base mapping to get the 'all' list and start with none mapped.
        const baseUrl = new URL(
          `/api/activity/mapping/${encodeURIComponent(parsed.op)}`,
          apiBase
        );
        const baseRes = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!baseRes.ok) throw new Error("Failed to load base mapping");
        const baseJson = (await baseRes.json()) as any;
        const rawAll: any[] = Array.isArray(baseJson.AllActions)
          ? baseJson.AllActions
          : Array.isArray(baseJson.all)
          ? baseJson.all
          : [];
        const all: MappingAction[] = rawAll.map((a) => ({
          id: String(a.id ?? a.Id ?? a.ID),
          action: String(a.action ?? a.Action),
          isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
          description:
            typeof a.description === "string"
              ? a.description
              : typeof a.Description === "string"
              ? a.Description
              : undefined,
        }));
        const merged: MappingData = {
          operationName: `${parsed.op}::${parsed.prop}`,
          exists: false,
          mapped: [],
          all,
        };
        setData(merged);
        setSelected(new Set<string>());
        setOriginalSelected(new Set<string>());
        // Show all when nothing is mapped yet
        setShowMappedOnly(false);
      } else {
        const url = new URL(
          `/api/activity/mapping/${encodeURIComponent(parsed.op)}`,
          apiBase
        );
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load mapping");
        const json = (await res.json()) as any;
        // Normalize 'all' items to { id, action, isPrivileged } regardless of casing
        const rawAll: any[] = Array.isArray(json.allActions)
          ? json.allActions
          : Array.isArray(json.all)
          ? json.all
          : [];
        const all: MappingAction[] = rawAll.map((a) => ({
          id: String(a.id ?? a.Id ?? a.ID),
          action: String(a.action ?? a.Action),
          isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
          description:
            typeof a.description === "string"
              ? a.description
              : typeof a.Description === "string"
              ? a.Description
              : undefined,
        }));
        // 'mapped' comes back as an array of action names (strings)
        const mappedNames: string[] = Array.isArray(json.mappedActions)
          ? (json.mappedActions as any[]).map((m) => String(m))
          : Array.isArray(json.mapped)
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
        // If nothing is mapped, default to show all
        setShowMappedOnly(selectedIds.size > 0);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [parsed, accessToken, apiBase]);

  useEffect(() => {
    if (open) {
      // default on each open; will be adjusted after load() based on mapped count
      setShowMappedOnly(false);
      load();
    } else {
      setData(null);
      setSelected(new Set());
      setOriginalSelected(new Set());
      // no local filter to reset
      setError(null);
    }
  }, [open, load]);

  // Remote search has been removed; backend returns complete 'all' list.

  // Build action strings for ResourceActionList based on Mapped-only filter
  const visibleActions = useMemo(() => {
    if (!data)
      return [] as Array<{
        action: string;
        isPrivileged?: boolean;
        description?: string;
      }>;
    let list = data.all.slice();
    if (showMappedOnly) list = list.filter((a) => selected.has(a.id));
    return list.map((a) => ({
      action: a.action,
      isPrivileged: a.isPrivileged,
      description: a.description,
    }));
  }, [data, showMappedOnly, selected]);

  // Map action strings <-> ids for selection bridging
  const selectedStrings = useMemo(() => {
    if (!data) return [] as string[];
    const byId = new Map<string, string>(
      data.all.map((a) => [String(a.id), a.action])
    );
    return Array.from(selected)
      .map((id) => byId.get(String(id)))
      .filter((v): v is string => Boolean(v));
  }, [data, selected]);

  const applySelectedStrings = useCallback(
    (vals: string[]) => {
      if (!data) return;
      const idByAction = new Map<string, string>(
        data.all.map((a) => [a.action.toLowerCase(), String(a.id)])
      );
      const next = new Set<string>();
      for (const s of vals) {
        const id = idByAction.get(s.toLowerCase());
        if (id) next.add(id);
      }
      setSelected(next);
    },
    [data]
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
          const url = new URL(`/api/activity/property`, apiBase);
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              activityName: parsed.op,
              propertyName: parsed.prop,
              resourceActionIds: bodyArr,
            }),
          });
          if (!res.ok) throw new Error("Failed to save property mapping");
          // After save, reload to get authoritative list
          await load();
          saved = null; // load handles state
        } else {
          const url = new URL(`/api/activity`, apiBase);
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              activityName: parsed.op,
              resourceActionIds: bodyArr,
            }),
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
                  Activity Mapping
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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Mapped only
                  </span>
                  <Switch
                    checked={showMappedOnly}
                    onCheckedChange={(v) => setShowMappedOnly(Boolean(v))}
                    aria-label="Show only currently mapped actions"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            <div className="border rounded h-[60vh] overflow-auto p-2 bg-card text-card-foreground">
              {loading && (
                <div className="text-xs text-muted-foreground">Loading...</div>
              )}
              {!loading && data && visibleActions.length === 0 && (
                <div className="text-xs text-muted-foreground">No actions.</div>
              )}
              {!loading && data && visibleActions.length > 0 && (
                <ResourceActionList
                  actions={visibleActions}
                  isSelectable
                  selected={selectedStrings}
                  onSelectedChange={applySelectedStrings}
                />
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
