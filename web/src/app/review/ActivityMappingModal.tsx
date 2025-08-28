import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
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
  namespace: string;
  resourceGroup: string;
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
  // Target resources and property multiselect (property-level mapping)
  type TargetResourceProperty = {
    id: string;
    propertyName: string;
    isSensitive: boolean;
    description?: string | null;
  };
  type TargetResourceDto = {
    id: string;
    resourceType: string;
    properties: TargetResourceProperty[];
  };
  const [targetResources, setTargetResources] = useState<TargetResourceDto[]>(
    []
  );
  const [trLoading, setTrLoading] = useState(false);
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  // Namespace/ResourceGroup filters
  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string>>(
    new Set()
  );
  const [selectedResourceGroups, setSelectedResourceGroups] = useState<
    Set<string>
  >(new Set());
  // menus are managed by Radix DropdownMenu, no manual open/close state needed

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
      // Apply server-side filters when available
      if (selectedNamespaces.size > 0) {
        url.searchParams.set(
          "namespaces",
          Array.from(selectedNamespaces).join(",")
        );
      }
      if (selectedResourceGroups.size > 0) {
        url.searchParams.set(
          "resourceGroups",
          Array.from(selectedResourceGroups).join(",")
        );
      }
      if (privOnly) {
        url.searchParams.set("priv", "true");
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load actions");
      const json = (await res.json()) as any;
      const rawAll: any[] = Array.isArray(json.allActions)
        ? json.allActions
        : [];
      const derive = (full: string) => {
        const parts = String(full || "").split("/");
        const ns = parts.length > 1 ? parts[0] : "";
        const rg = parts.length > 2 ? parts[1] : "";
        return { ns, rg };
      };
      let actions: MappingAction[] = rawAll.map((a) => {
        const action = String(a.action ?? a.Action ?? "");
        const { ns, rg } = derive(action);
        const namespace = String(a.namespace ?? a.Namespace ?? ns ?? "");
        const resourceGroup = String(
          a.resourceGroup ?? a.ResourceGroup ?? rg ?? ""
        );
        return {
          id: String(a.id ?? a.Id ?? a.ID),
          action,
          isPrivileged: Boolean(a.isPrivileged ?? a.IsPrivileged),
          namespace,
          resourceGroup,
        };
      });
      // If preselectedIds are provided (e.g., opening from RoleDetails permission set),
      // show only those actions in the list.
      if (
        mode === "create" &&
        preselectedIds &&
        Array.isArray(preselectedIds) &&
        preselectedIds.length > 0
      ) {
        const idSet = new Set(preselectedIds.map(String));
        actions = actions.filter((a) => idSet.has(a.id));
      }
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
  }, [
    accessToken,
    apiBase,
    mode,
    initialActivityName,
    preselectedIds,
    selectedNamespaces,
    selectedResourceGroups,
    privOnly,
  ]);

  useEffect(() => {
    if (open) {
      setName(initialActivityName || "");
      setFilter("");
      setPrivOnly(false);
      setSelected(new Set());
      setOriginalSelected(new Set());
      setSelectedNamespaces(new Set());
      setSelectedResourceGroups(new Set());
      setSelectedProps(new Set());
      // Load immediately (uses placeholder name for create to get 'all')
      load();
    }
  }, [open, initialActivityName]);
  // DropdownMenu handles click-outside automatically
  // When open or relevant inputs change that do not include live-typed name for create, load once
  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken, apiBase, mode, initialActivityName]);

  // Load target resources for the current activity (edit mode preferred)
  useEffect(() => {
    if (!open || !accessToken) return;
    const actName = (mode === "edit" ? initialActivityName : name)?.trim();
    if (!actName) {
      setTargetResources([]);
      return;
    }
    (async () => {
      try {
        setTrLoading(true);
        // Find activity id by name
        const actsRes = await fetch(new URL("/api/activity", apiBase), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!actsRes.ok) {
          setTargetResources([]);
          return;
        }
        const arr = (await actsRes.json()) as any[];
        const match = Array.isArray(arr)
          ? arr.find(
              (a) =>
                String(
                  a?.activityName ?? a?.ActivityName ?? a?.name ?? a?.Name ?? ""
                ).toLowerCase() === actName.toLowerCase()
            )
          : null;
        const actId = match ? String(match?.id ?? match?.Id ?? "") : null;
        if (!actId) {
          setTargetResources([]);
          return;
        }
        const trRes = await fetch(
          new URL(`/api/activity/${actId}/targetresource`, apiBase),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!trRes.ok) {
          setTargetResources([]);
          return;
        }
        const json = (await trRes.json()) as any[];
        const mapped: TargetResourceDto[] = Array.isArray(json)
          ? json.map((r: any) => ({
              id: String(r?.id ?? r?.Id ?? r?.ID ?? ""),
              resourceType: String(
                r?.resourceType ?? r?.ResourceType ?? r?.type ?? ""
              ),
              properties: Array.isArray(r?.properties ?? r?.Properties)
                ? (r?.properties ?? r?.Properties).map((p: any) => ({
                    id: String(p?.id ?? p?.Id ?? p?.ID ?? ""),
                    propertyName: String(
                      p?.propertyName ??
                        p?.PropertyName ??
                        p?.name ??
                        p?.Name ??
                        ""
                    ),
                    isSensitive: Boolean(
                      p?.isSensitive ?? p?.IsSensitive ?? false
                    ),
                    description: (p?.description ?? p?.Description ?? null) as
                      | string
                      | null,
                  }))
                : [],
            }))
          : [];
        setTargetResources(mapped);
      } catch {
        setTargetResources([]);
      } finally {
        setTrLoading(false);
      }
    })();
  }, [open, accessToken, apiBase, mode, initialActivityName, name]);

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

  // Build filter option lists
  const namespaceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of all) {
      if (a.namespace) set.add(a.namespace);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const resourceGroupOptions = useMemo(() => {
    let base = all;
    if (selectedNamespaces.size > 0) {
      base = base.filter(
        (a) => a.namespace && selectedNamespaces.has(a.namespace)
      );
    }
    const set = new Set<string>();
    for (const a of base) {
      if (a.resourceGroup) set.add(a.resourceGroup);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all, selectedNamespaces]);

  // Prune resource group selections that are no longer valid after namespace change
  useEffect(() => {
    if (selectedResourceGroups.size === 0) return;
    const valid = new Set(resourceGroupOptions);
    const next = new Set(
      Array.from(selectedResourceGroups).filter((rg) => valid.has(rg))
    );
    if (next.size !== selectedResourceGroups.size) {
      setSelectedResourceGroups(next);
    }
  }, [resourceGroupOptions]);

  const filtered = useMemo(() => {
    const t = filter.trim().toLowerCase();
    let list = all;
    if (privOnly) list = list.filter((a) => a.isPrivileged);
    if (selectedNamespaces.size > 0) {
      list = list.filter(
        (a) => a.namespace && selectedNamespaces.has(a.namespace)
      );
    }
    if (selectedResourceGroups.size > 0) {
      list = list.filter(
        (a) => a.resourceGroup && selectedResourceGroups.has(a.resourceGroup)
      );
    }
    if (t) list = list.filter((a) => a.action.toLowerCase().includes(t));
    // Deterministic order: selected first, then by name
    return list.slice().sort((a, b) => {
      const as = selected.has(a.id) ? 0 : 1;
      const bs = selected.has(b.id) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.action.localeCompare(b.action);
    });
  }, [
    all,
    filter,
    privOnly,
    selected,
    selectedNamespaces,
    selectedResourceGroups,
  ]);

  // If any filter is active, drop selection for items not in the filtered result
  useEffect(() => {
    const anyFilterActive =
      privOnly ||
      selectedNamespaces.size > 0 ||
      selectedResourceGroups.size > 0 ||
      filter.trim().length > 0;
    if (!anyFilterActive || selected.size === 0) return;
    const visible = new Set(filtered.map((a) => a.id));
    let changed = false;
    const next = new Set<string>();
    selected.forEach((id) => {
      if (visible.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelected(next);
  }, [
    filtered,
    privOnly,
    selectedNamespaces,
    selectedResourceGroups,
    filter,
    selected,
  ]);

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
      if (selectedProps.size > 0) {
        // Save to property-level mapping for each selected property name
        for (const prop of selectedProps) {
          const propUrl = new URL(`/api/activity/property`, apiBase);
          const r = await fetch(propUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              activityName: actName,
              propertyName: prop,
              resourceActionIds: ids,
            }),
          });
          if (!r.ok)
            throw new Error(`Failed to save mapping for property ${prop}`);
        }
        toast.success("Property mapping saved", {
          description: `${ids.length} actions mapped to ${
            selectedProps.size
          } propert${selectedProps.size === 1 ? "y" : "ies"}`,
        });
      } else {
        // Default to activity-level mapping
        const url = new URL(`/api/activity`, apiBase);
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activityName: actName,
            resourceActionIds: ids,
          }),
        });
        if (!res.ok) throw new Error("Failed to save mapping");
        toast.success("Mapping saved", {
          description: `${ids.length} actions mapped`,
        });
      }
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

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
              <DropdownMenu
                open={activityOpen}
                onOpenChange={(o) => {
                  setActivityOpen(o);
                  if (!o) setActivityQuery("");
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full border rounded px-2 py-1 text-xs bg-background text-left flex items-center justify-between"
                    aria-haspopup="listbox"
                  >
                    <span className="truncate">
                      {name ? name : "Select or type an activity…"}
                    </span>
                    <span className="ml-2 text-muted-foreground">▾</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-[90] w-[--radix-dropdown-menu-trigger-width] min-w-[16rem]">
                  <div className="p-2">
                    <input
                      className="w-full border rounded px-2 py-1 text-xs bg-background"
                      placeholder="Search or enter new…"
                      value={activityQuery}
                      onChange={(e) => setActivityQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-auto">
                    {activities
                      .filter((a) =>
                        activityQuery
                          ? a
                              .toLowerCase()
                              .includes(activityQuery.toLowerCase())
                          : true
                      )
                      .map((a) => (
                        <DropdownMenuItem
                          key={a}
                          onSelect={(e) => {
                            e.preventDefault();
                            setName(a);
                            setActivityQuery("");
                            setActivityOpen(false);
                          }}
                          className="text-xs"
                        >
                          {a}
                        </DropdownMenuItem>
                      ))}
                    {activityQuery.trim() &&
                      activities.every(
                        (a) =>
                          a.toLowerCase() !== activityQuery.trim().toLowerCase()
                      ) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setName(activityQuery.trim());
                              setActivityOpen(false);
                            }}
                            className="text-xs"
                          >
                            Use “{activityQuery.trim()}”
                          </DropdownMenuItem>
                        </>
                      )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </label>
          {/* Target resource and property selection (optional). Select properties to map actions at property-level. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Target resource properties (optional)
              </div>
              <div className="text-[11px] text-muted-foreground">
                {selectedProps.size > 0
                  ? `${selectedProps.size} selected`
                  : "None selected"}
              </div>
            </div>
            <div className="border rounded bg-muted/40 overflow-hidden max-h-48 overflow-auto p-2">
              {trLoading ? (
                <div className="text-[11px] text-muted-foreground px-1">
                  Loading target resources…
                </div>
              ) : targetResources.length === 0 ? (
                <div className="text-[11px] text-muted-foreground px-1">
                  No target resources
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-1">
                  {targetResources.map((r) => {
                    const props = Array.isArray(r.properties)
                      ? r.properties
                      : [];
                    return (
                      <AccordionItem
                        key={r.resourceType}
                        value={r.resourceType}
                      >
                        <AccordionTrigger className="px-2 text-xs">
                          {r.resourceType || "(unknown)"}
                        </AccordionTrigger>
                        <AccordionContent>
                          {props.length > 0 && (
                            <div className="flex items-center justify-between px-2 pb-1">
                              <div className="text-[11px] text-muted-foreground">
                                {props.length} propert
                                {props.length === 1 ? "y" : "ies"}
                              </div>
                              {(() => {
                                const allSelected = props.every((p) =>
                                  selectedProps.has(p.propertyName)
                                );
                                const anySelected = props.some((p) =>
                                  selectedProps.has(p.propertyName)
                                );
                                return (
                                  <label className="inline-flex items-center gap-2 text-[11px]">
                                    <Checkbox
                                      checked={allSelected}
                                      onCheckedChange={() =>
                                        setSelectedProps((prev) => {
                                          const next = new Set(prev);
                                          if (allSelected) {
                                            for (const p of props)
                                              next.delete(p.propertyName);
                                          } else {
                                            for (const p of props)
                                              next.add(p.propertyName);
                                          }
                                          return next;
                                        })
                                      }
                                      aria-label={`Select all properties for ${r.resourceType}`}
                                    />
                                    <span
                                      className={
                                        anySelected && !allSelected
                                          ? "opacity-80"
                                          : undefined
                                      }
                                    >
                                      Select all
                                    </span>
                                  </label>
                                );
                              })()}
                            </div>
                          )}
                          <ul className="space-y-1">
                            {props.length === 0 && (
                              <li className="text-[11px] text-muted-foreground px-2">
                                No properties
                              </li>
                            )}
                            {props.map((p) => {
                              const key = p.propertyName;
                              const checked = selectedProps.has(key);
                              return (
                                <li
                                  key={`${r.resourceType}:${key}`}
                                  className="flex items-center gap-2 px-2"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() =>
                                      setSelectedProps((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key);
                                        else next.add(key);
                                        return next;
                                      })
                                    }
                                    aria-label={`Select property ${key}`}
                                  />
                                  <span className="font-mono text-xs break-all">
                                    {key}
                                  </span>
                                  {p.isSensitive && (
                                    <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                                      sensitive
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Privileged only</span>
              <Switch
                checked={privOnly}
                onCheckedChange={(v: boolean) => setPrivOnly(Boolean(v))}
                aria-label="Filter list to privileged actions only"
                disabled={loading}
              />
            </div>
            {/* Namespace filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="border rounded px-2 py-1 text-xs bg-background min-w-[10rem] text-left flex items-center justify-between"
                  aria-haspopup="listbox"
                >
                  <span className="truncate">
                    {selectedNamespaces.size > 0
                      ? `${selectedNamespaces.size} namespace${
                          selectedNamespaces.size > 1 ? "s" : ""
                        }`
                      : "All namespaces"}
                  </span>
                  <span className="ml-2 text-muted-foreground">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-[90] w-[26rem]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Namespaces
                </DropdownMenuLabel>
                <div className="max-h-64 overflow-auto p-1">
                  {namespaceOptions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground px-2 py-1">
                      No namespaces
                    </div>
                  )}
                  {namespaceOptions.map((ns) => {
                    const checked = selectedNamespaces.has(ns);
                    return (
                      <DropdownMenuCheckboxItem
                        key={ns}
                        checked={checked}
                        onCheckedChange={(v) => {
                          const val = Boolean(v);
                          setSelectedNamespaces((prev) => {
                            const next = new Set(prev);
                            if (val) next.add(ns);
                            else next.delete(ns);
                            return next;
                          });
                        }}
                        onSelect={(e) => e.preventDefault()}
                        className="text-xs"
                      >
                        <span className="truncate font-mono">{ns}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedNamespaces(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Resource group filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="border rounded px-2 py-1 text-xs bg-background min-w-[10rem] text-left flex items-center justify-between disabled:opacity-50"
                  aria-haspopup="listbox"
                  disabled={resourceGroupOptions.length === 0}
                  title={
                    selectedNamespaces.size > 0
                      ? "Filtered by selected namespaces"
                      : "All namespaces"
                  }
                >
                  <span className="truncate">
                    {selectedResourceGroups.size > 0
                      ? `${selectedResourceGroups.size} group${
                          selectedResourceGroups.size > 1 ? "s" : ""
                        }`
                      : "All resource groups"}
                  </span>
                  <span className="ml-2 text-muted-foreground">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-[90] w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Resource groups
                </DropdownMenuLabel>
                <div className="max-h-64 overflow-auto p-1">
                  {resourceGroupOptions.length === 0 && (
                    <div className="text-[11px] text-muted-foreground px-2 py-1">
                      No resource groups
                    </div>
                  )}
                  {resourceGroupOptions.map((rg) => {
                    const checked = selectedResourceGroups.has(rg);
                    return (
                      <DropdownMenuCheckboxItem
                        key={rg}
                        checked={checked}
                        onCheckedChange={(v) => {
                          const val = Boolean(v);
                          setSelectedResourceGroups((prev) => {
                            const next = new Set(prev);
                            if (val) next.add(rg);
                            else next.delete(rg);
                            return next;
                          });
                        }}
                        onSelect={(e) => e.preventDefault()}
                        className="text-xs"
                      >
                        <span className="truncate font-mono">{rg}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedResourceGroups(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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
    </div>,
    document.body
  );
}

export default ActivityMappingModal;
