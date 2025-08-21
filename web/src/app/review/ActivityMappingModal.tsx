import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { toast } from "sonner";

interface MappingAction {
  id: string; // Guid
  action: string;
  isPrivileged: boolean;
}

export function ActivityMappingModal({
  open,
  onOpenChange,
  accessToken,
  apiBase,
  initialActivityName,
  mode, // "create" | "edit"
  onSaved,
  preselectedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accessToken: string | null;
  apiBase: string;
  initialActivityName?: string | null;
  mode: "create" | "edit";
  onSaved?: (activityName: string) => void;
  preselectedIds?: string[];
}) {
  const [name, setName] = useState<string>(initialActivityName || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<MappingAction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(
    new Set()
  );
  const [filter, setFilter] = useState("");
  const [privOnly, setPrivOnly] = useState(false);
  const [properties, setProperties] = useState<Record<string, number>>({});
  const [newPropName, setNewPropName] = useState<string>("");

  // Activities dropdown state (create mode)
  const [activities, setActivities] = useState<string[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");

  // Fetch all activities from API (GetAllActivities endpoint)
  useEffect(() => {
    if (!open || !accessToken) return;
    (async () => {
      try {
        const res = await fetch(new URL("/api/activity", apiBase), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const arr: string[] = Array.isArray(json)
          ? json
              .map((a: any) =>
                typeof a === "string"
                  ? a
                  : String(
                      a?.activityName ??
                        a?.ActivityName ??
                        a?.name ??
                        a?.Name ??
                        ""
                    )
              )
              .filter(Boolean)
          : [];
        setActivities(arr);
      } catch {
        setActivities([]);
      }
    })();
  }, [open, accessToken, apiBase]);

  // Load list of all actions and existing mapping (if edit)
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      // Use a constant name in create mode so typing does not trigger reload/reset
      const opName =
        mode === "edit" ? initialActivityName || name || "__edit__" : "__new__";
      const url = new URL(
        `/api/activity/mapping/${encodeURIComponent(opName)}`,
        apiBase
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load actions");
      const json = (await res.json()) as any;
      const rawAll: any[] = Array.isArray(json.allActions)
        ? json.allActions
        : [];
      const actions: MappingAction[] = rawAll.map((a) => ({
        id: String(a.id ?? a.Id ?? a.ID),
        action: String(a.action ?? a.Action),
        isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
      }));
      setAll(actions);
      // Determine initial selection
      let sel = new Set<string>();
      if (mode === "edit" && initialActivityName) {
        const mappedNames: string[] = Array.isArray(json.mappedActions)
          ? (json.mappedActions as any[]).map((m) => String(m))
          : [];
        sel = new Set(
          actions
            .filter((a) =>
              mappedNames.some(
                (n) => n.toLowerCase() === a.action.toLowerCase()
              )
            )
            .map((a) => a.id)
        );
      } else if (
        mode === "create" &&
        preselectedIds &&
        preselectedIds.length > 0
      ) {
        const idSet = new Set(preselectedIds);
        sel = new Set(actions.filter((a) => idSet.has(a.id)).map((a) => a.id));
      }
      setSelected(sel);
      setOriginalSelected(new Set(sel));
    } catch (e: any) {
      setError(e.message || "Failed to load");
      setAll([]);
      setSelected(new Set());
      setOriginalSelected(new Set());
      setProperties({});
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase, mode, initialActivityName, preselectedIds]);

  useEffect(() => {
    if (open) {
      setName(initialActivityName || "");
      setFilter("");
      setPrivOnly(false);
      setSelected(new Set());
      setOriginalSelected(new Set());
      // Load immediately (uses placeholder name for create to get 'all')
      load();
    }
  }, [open, initialActivityName]);
  // When open or relevant inputs change that do not include live-typed name for create, load once
  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken, apiBase, mode, initialActivityName]);

  // Load properties for the current activity name without resetting action list or selection
  useEffect(() => {
    if (!open || !accessToken) return;
    const act = (mode === "edit" ? initialActivityName : name)?.trim();
    if (!act) {
      setProperties({});
      return;
    }
    (async () => {
      try {
        const expRes = await fetch(new URL(`/api/activity/export`, apiBase), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!expRes.ok) {
          setProperties({});
          return;
        }
        const expJson = await expRes.json();
        const arr: any[] = Array.isArray(expJson)
          ? expJson
          : typeof expJson === "object" && expJson
          ? Object.values(expJson as any)
          : [];
        const match = arr.find(
          (x) =>
            String(x.name ?? x.Name ?? "").toLowerCase() === act.toLowerCase()
        );
        const props = (match?.properties ?? match?.Properties) || {};
        const mapped: Record<string, number> = {};
        Object.keys(props).forEach((k) => {
          const v = props[k] as any[];
          mapped[k] = Array.isArray(v) ? v.length : 0;
        });
        setProperties(mapped);
      } catch {
        setProperties({});
      }
    })();
  }, [open, accessToken, apiBase, mode, initialActivityName, name]);

  const hasChanges = useMemo(() => {
    if (mode === "create") return selected.size > 0 && !!name.trim();
    if (selected.size !== originalSelected.size) return true;
    for (const id of selected) if (!originalSelected.has(id)) return true;
    return false;
  }, [selected, originalSelected, mode, name]);

  const filtered = useMemo(() => {
    const t = filter.trim().toLowerCase();
    let list = all;
    if (privOnly) list = list.filter((a) => a.isPrivileged);
    if (t) list = list.filter((a) => a.action.toLowerCase().includes(t));
    // Deterministic order: selected first, then by name
    return list.slice().sort((a, b) => {
      const as = selected.has(a.id) ? 0 : 1;
      const bs = selected.has(b.id) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.action.localeCompare(b.action);
    });
  }, [all, filter, privOnly, selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = useCallback(async () => {
    if (!accessToken) return;
    const actName = name.trim();
    if (!actName) {
      toast.error("Activity name is required");
      return;
    }
    try {
      setSaving(true);
      const ids = Array.from(selected);
      const url = new URL(`/api/activity`, apiBase);
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activityName: actName, resourceActionIds: ids }),
      });
      if (!res.ok) throw new Error("Failed to save mapping");
      toast.success("Mapping saved", {
        description: `${ids.length} actions mapped`,
      });
      window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
      onSaved?.(actName);
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [accessToken, apiBase, name, selected, onSaved, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !saving && onOpenChange(false)}
      />
      <div className="relative bg-card text-card-foreground w-full max-w-2xl rounded-lg shadow-lg border p-5 space-y-4 animate-in fade-in zoom-in">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium tracking-wide">
            {mode === "create" ? "Create activity mapping" : `Edit mapping`}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Loading" : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Close
            </Button>
          </div>
        </div>
        {error && <div className="text-[10px] text-red-600">{error}</div>}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">
              Activity name
            </span>
            {mode === "edit" ? (
              <input
                className="border rounded px-2 py-1 text-xs bg-background w-full"
                value={name}
                disabled
                readOnly
              />
            ) : (
              <div className="relative">
                <button
                  type="button"
                  className="w-full border rounded px-2 py-1 text-xs bg-background text-left flex items-center justify-between"
                  onClick={() => setActivityOpen((v) => !v)}
                  aria-haspopup="listbox"
                >
                  <span className="truncate">
                    {name ? name : "Select or type an activity…"}
                  </span>
                  <span className="ml-2 text-muted-foreground">▾</span>
                </button>
                {activityOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded border bg-popover text-popover-foreground shadow">
                    <div className="p-2">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs bg-background"
                        placeholder="Search or enter new…"
                        value={activityQuery}
                        onChange={(e) => setActivityQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div
                      className="max-h-60 overflow-auto"
                      role="listbox"
                      aria-label="Activities"
                    >
                      {activities
                        .filter((a) =>
                          activityQuery
                            ? a
                                .toLowerCase()
                                .includes(activityQuery.toLowerCase())
                            : true
                        )
                        .map((a) => (
                          <div
                            key={a}
                            role="option"
                            data-selected={name === a ? "true" : "false"}
                            className="px-2 py-1 text-xs hover:bg-muted cursor-pointer"
                            onMouseDown={() => {
                              setName(a);
                              setActivityQuery("");
                              setActivityOpen(false);
                            }}
                          >
                            {a}
                          </div>
                        ))}
                      {activityQuery.trim() &&
                        activities.every(
                          (a) =>
                            a.toLowerCase() !==
                            activityQuery.trim().toLowerCase()
                        ) && (
                          <div className="border-t p-2">
                            <Button
                              size="sm"
                              className="w-full justify-start"
                              variant="secondary"
                              onMouseDown={() => {
                                setName(activityQuery.trim());
                                setActivityOpen(false);
                              }}
                            >
                              Use “{activityQuery.trim()}”
                            </Button>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                className="border rounded px-2 py-1 text-xs bg-background flex-1"
                placeholder="New property name"
                value={newPropName}
                onChange={(e) => setNewPropName(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const act = (
                    mode === "edit" ? initialActivityName : name
                  )?.trim();
                  if (!act) {
                    toast.error("Set an activity name first");
                    return;
                  }
                  const val = newPropName.trim();
                  if (!val) return;
                  setNewPropName("");
                  onOpenChange(false);
                  window.dispatchEvent(
                    new CustomEvent("open-op-mapping", {
                      detail: { operationName: `${act}::${val}` },
                    })
                  );
                }}
              >
                Add property
              </Button>
            </div>
            <div className="border rounded bg-muted/40 overflow-hidden">
              <Table className="text-xs">
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="w-2/3">Property</TableHead>
                    <TableHead className="text-right">Mapped actions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(properties).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No properties
                      </TableCell>
                    </TableRow>
                  ) : (
                    Object.entries(properties).map(([p, count]) => (
                      <TableRow key={p}>
                        <TableCell>
                          <span className="font-mono break-all">{p}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {count}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            title={`Edit ${name}::${p}`}
                            onClick={() => {
                              const act = (
                                mode === "edit" ? initialActivityName : name
                              )?.trim();
                              if (!act) return;
                              onOpenChange(false);
                              window.dispatchEvent(
                                new CustomEvent("open-op-mapping", {
                                  detail: { operationName: `${act}::${p}` },
                                })
                              );
                            }}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Privileged only</span>
              <Switch
                checked={privOnly}
                onCheckedChange={(v) => setPrivOnly(Boolean(v))}
                aria-label="Filter list to privileged actions only"
                disabled={loading}
              />
            </div>
            <input
              className="border rounded px-2 py-1 text-xs bg-background flex-1"
              placeholder="Filter actions"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="border rounded h-[50vh] overflow-auto p-2 bg-muted/40">
            {loading && (
              <div className="text-[11px] text-muted-foreground">
                Loading actions…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-[11px] text-muted-foreground">
                No actions
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <ul className="space-y-1 text-xs">
                {filtered.map((a) => {
                  const checked = selected.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(a.id)}
                      />
                      <span
                        className={`font-mono flex-1 ${
                          checked ? "" : "text-muted-foreground"
                        }`}
                      >
                        {a.action}
                      </span>
                      {a.isPrivileged && (
                        <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                          priv
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !hasChanges || !name.trim()}
            className={
              hasChanges
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
                : ""
            }
          >
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ActivityMappingModal;
