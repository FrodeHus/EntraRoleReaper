import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accessToken: string | null;
  apiBase: string;
  initialActivityName?: string | null;
  mode: "create" | "edit";
  onSaved?: (activityName: string) => void;
}) {
  const [name, setName] = useState<string>(initialActivityName || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<MappingAction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [privOnly, setPrivOnly] = useState(false);

  // Load list of all actions and existing mapping (if edit)
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const opName = name || "__new__"; // any string works for fetching all actions
      const url = new URL(`/api/operations/map/${encodeURIComponent(opName)}`, apiBase);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Failed to load actions");
      const json = (await res.json()) as any;
      const rawAll: any[] = Array.isArray(json.all) ? json.all : [];
      const actions: MappingAction[] = rawAll.map((a) => ({
        id: String(a.id ?? a.Id ?? a.ID),
        action: String(a.action ?? a.Action),
        isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
      }));
      setAll(actions);
      // If editing with a real activity name, map current selection from mapped names
      let sel = new Set<string>();
      if (mode === "edit" && initialActivityName) {
        const mappedNames: string[] = Array.isArray(json.mapped)
          ? (json.mapped as any[]).map((m) => String(m))
          : [];
        sel = new Set(
          actions
            .filter((a) => mappedNames.some((n) => n.toLowerCase() === a.action.toLowerCase()))
            .map((a) => a.id)
        );
      }
      setSelected(sel);
      setOriginalSelected(new Set(sel));
    } catch (e: any) {
      setError(e.message || "Failed to load");
      setAll([]);
      setSelected(new Set());
      setOriginalSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase, name, mode, initialActivityName]);

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
  }, [open, initialActivityName, load]);

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
    return list
      .slice()
      .sort((a, b) => {
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
      const url = new URL(`/api/operations/map/${encodeURIComponent(actName)}`, apiBase);
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ids),
      });
      if (!res.ok) throw new Error("Failed to save mapping");
      toast.success("Mapping saved", { description: `${ids.length} actions mapped` });
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onOpenChange(false)} />
      <div className="relative bg-card text-card-foreground w-full max-w-2xl rounded-lg shadow-lg border p-5 space-y-4 animate-in fade-in zoom-in">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium tracking-wide">
            {mode === "create" ? "Create activity mapping" : `Edit mapping`}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? "Loading" : "Refresh"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Close
            </Button>
          </div>
        </div>
        {error && <div className="text-[10px] text-red-600">{error}</div>}
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-[11px] text-muted-foreground">Activity name</span>
            <input
              className="border rounded px-2 py-1 text-xs bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g., Reset user password"
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <Checkbox checked={privOnly} onCheckedChange={() => setPrivOnly((v) => !v)} />
              Is privileged (filter list)
            </label>
            <input
              className="border rounded px-2 py-1 text-xs bg-background flex-1"
              placeholder="Filter actions"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="border rounded h-[50vh] overflow-auto p-2 bg-muted/40">
            {loading && <div className="text-[11px] text-muted-foreground">Loading actions…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-[11px] text-muted-foreground">No actions</div>
            )}
            {!loading && filtered.length > 0 && (
              <ul className="space-y-1 text-xs">
                {filtered.map((a) => {
                  const checked = selected.has(a.id);
                  return (
                    <li key={a.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/50">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(a.id)} />
                      <span className={`font-mono flex-1 ${checked ? "" : "text-muted-foreground"}`}>{a.action}</span>
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
            className={hasChanges ? "border-emerald-600 text-emerald-700 dark:text-emerald-300" : ""}
          >
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ActivityMappingModal;
