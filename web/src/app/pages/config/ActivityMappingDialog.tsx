import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Input } from "../../../components/ui/input";
import ResourceActionList, {
  type ResourceActionListHandle,
} from "@/components/ResourceActionList";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Checkbox } from "../../../components/ui/checkbox";
import { ResourceActionPill } from "../../../components/ResourceActionPill";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card";
import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";

type MappingMode = "create" | "edit";

type ResourceActionDto = {
  id: string;
  action: string;
  description: string;
  isPrivileged: boolean;
  namespace: string;
  resourceGroup: string;
};

type ActivityRow = {
  id: string;
  name: string;
};

type TargetResourceProperty = {
  id: string; // Guid
  propertyName: string;
  isSensitive: boolean;
  description?: string | null;
  mappedResourceActions?: ResourceActionDto[];
};

type TargetResourceDto = {
  id: string; // Guid
  resourceType: string;
  properties: TargetResourceProperty[];
};

export function ActivityMappingDialog({
  open,
  onOpenChange,
  accessToken,
  apiBase,
  mode,
  initialActivityName,
  onSaved,
  preselectedIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accessToken: string | null;
  apiBase: string;
  mode: MappingMode;
  initialActivityName?: string | null;
  onSaved?: (activityName: string) => void;
  preselectedIds?: string[];
}) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activityName, setActivityName] = useState<string>(
    initialActivityName || ""
  );
  const [activityId, setActivityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actions
  const [allActions, setAllActions] = useState<ResourceActionDto[]>([]);
  const [mappedActionNames, setMappedActionNames] = useState<Set<string>>(
    new Set()
  );
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(
    new Set()
  );
  // ResourceActionList provides built-in search; remove local search

  // Target resources
  const [targetResources, setTargetResources] = useState<TargetResourceDto[]>(
    []
  );
  const [expandedTr, setExpandedTr] = useState<string[]>([]);
  const [selectedPropIds, setSelectedPropIds] = useState<Set<string>>(
    new Set()
  );
  const [selectAllProps, setSelectAllProps] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setActivityName(initialActivityName || "");
    setSelectedActionIds(new Set());
    setSelectedPropIds(new Set());
    setSelectAllProps(false);
    setExpandedTr([]);
    setError(null);
  }, [open, initialActivityName]);

  // Load activities
  useEffect(() => {
    if (!open || !accessToken) return;
    (async () => {
      try {
        const res = await fetch(new URL("/api/activity", apiBase), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load activities");
        const json = (await res.json()) as any[];
        const arr: ActivityRow[] = Array.isArray(json)
          ? json
              .map((a) => ({
                id: String((a as any)?.id ?? (a as any)?.Id ?? ""),
                name: String(
                  (a as any)?.activityName ??
                    (a as any)?.ActivityName ??
                    (a as any)?.name ??
                    (a as any)?.Name ??
                    ""
                ),
              }))
              .filter((x) => x.id && x.name)
          : [];
        setActivities(arr);
      } catch {
        setActivities([]);
      }
    })();
  }, [open, accessToken, apiBase]);

  // Resolve activityId by name when editing or when picking an existing in create
  useEffect(() => {
    if (!open) return;
    const name = activityName?.trim();
    if (!name) {
      setActivityId(null);
      return;
    }
    const match = activities.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    setActivityId(match ? match.id : null);
  }, [open, activityName, activities]);

  // Load actions and mapped activity-level actions
  const loadActions = useCallback(async () => {
    if (!accessToken || !activityName?.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const url = new URL(
        `/api/activity/mapping/${encodeURIComponent(activityName.trim())}`,
        apiBase
      );
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load actions");
      const json = await res.json();
      const rawAll: any[] = Array.isArray(json?.allActions)
        ? json.allActions
        : [];
      const all: ResourceActionDto[] = rawAll.map((a) => ({
        id: String(a?.id ?? a?.Id ?? a?.ID ?? ""),
        action: String(a?.action ?? a?.Action ?? ""),
        description: String(a?.description ?? a?.Description ?? ""),
        isPrivileged: Boolean(a?.isPrivileged ?? a?.IsPrivileged ?? false),
        namespace: String(a?.namespace ?? a?.Namespace ?? ""),
        resourceGroup: String(a?.resourceGroup ?? a?.ResourceGroup ?? ""),
      }));
      const mappedNames = new Set<string>(
        (Array.isArray(json?.mappedActions) ? json.mappedActions : []).map(
          (x: any) => String(x || "")
        )
      );
      setAllActions(all);
      setMappedActionNames(mappedNames);
      // Preselect mapped only if no properties are selected
      if (selectedPropIds.size === 0) {
        const mappedLower = new Set(
          Array.from(mappedNames).map((n) => n.toLowerCase())
        );
        let idSet = new Set(
          all
            .filter((a) => mappedLower.has(a.action.toLowerCase()))
            .map((a) => String(a.id))
        );
        // If creating and preselectedIds are provided, intersect with available actions
        if (mode === "create" && preselectedIds && preselectedIds.length > 0) {
          const pre = new Set(preselectedIds.map(String));
          idSet = new Set(all.filter((a) => pre.has(a.id)).map((a) => a.id));
        }
        setSelectedActionIds(idSet);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load actions");
      setAllActions([]);
      setMappedActionNames(new Set());
      setSelectedActionIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    apiBase,
    activityName,
    selectedPropIds.size,
    mode,
    preselectedIds,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!activityName?.trim()) return;
    void loadActions();
  }, [open, activityName, loadActions]);

  // Load target resources for the activity (only when we have an id)
  useEffect(() => {
    if (!open || !accessToken || !activityId) {
      setTargetResources([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          new URL(`/api/activity/${activityId}/targetresource`, apiBase),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) throw new Error("Failed to load target resources");
        const json = (await res.json()) as any[];
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
                    mappedResourceActions: Array.isArray(
                      p?.mappedResourceActions ?? p?.MappedResourceActions
                    )
                      ? (
                          p?.mappedResourceActions ?? p?.MappedResourceActions
                        ).map((ra: any) => ({
                          id: String(ra?.id ?? ra?.Id ?? ra?.ID ?? ""),
                          action: String(ra?.action ?? ra?.Action ?? ""),
                          isPrivileged: Boolean(
                            ra?.isPrivileged ?? ra?.IsPrivileged ?? false
                          ),
                          namespace: String(
                            ra?.namespace ?? ra?.Namespace ?? ""
                          ),
                          resourceGroup: String(
                            ra?.resourceGroup ?? ra?.ResourceGroup ?? ""
                          ),
                        }))
                      : [],
                  }))
                : [],
            }))
          : [];
        setTargetResources(mapped);
      } catch {
        setTargetResources([]);
      }
    })();
  }, [open, accessToken, apiBase, activityId]);

  // When no properties are selected, reflect activity-level mapped actions in checkbox selection (edit mode)
  useEffect(() => {
    if (!open) return;
    if (selectedPropIds.size !== 0) return;
    if (mode !== "edit") return;
    if (allActions.length === 0 || mappedActionNames.size === 0) return;
    const mappedLower = new Set(
      Array.from(mappedActionNames).map((n) => n.toLowerCase())
    );
    const idSet = new Set(
      allActions
        .filter((a) => mappedLower.has(a.action.toLowerCase()))
        .map((a) => String(a.id))
    );
    setSelectedActionIds(idSet);
  }, [open, mode, selectedPropIds.size, allActions, mappedActionNames]);

  // When properties are selected, ensure actions already mapped to those properties are selected
  useEffect(() => {
    if (selectedPropIds.size === 0) return;
    const mappedFromProps = new Set<string>();
    for (const tr of targetResources) {
      for (const p of tr.properties || []) {
        if (selectedPropIds.has(p.id)) {
          const ras = (p as any).mappedResourceActions as
            | ResourceActionDto[]
            | undefined;
          if (Array.isArray(ras)) {
            for (const ra of ras) {
              if (ra?.id) mappedFromProps.add(String(ra.id));
            }
          }
        }
      }
    }
    if (mappedFromProps.size > 0) {
      setSelectedActionIds((prev) => new Set([...prev, ...mappedFromProps]));
    }
  }, [selectedPropIds, targetResources]);

  // Select all toggle effect
  useEffect(() => {
    if (!selectAllProps) return;
    const allPropIds = new Set<string>();
    const openKeys: string[] = [];
    for (const tr of targetResources) {
      if (tr.resourceType) openKeys.push(tr.resourceType);
      for (const p of tr.properties || []) allPropIds.add(p.id);
    }
    setSelectedPropIds(allPropIds);
    setExpandedTr(openKeys);
  }, [selectAllProps, targetResources]);

  // Keep deterministic order: selected first, then by name (for mapping only)
  const orderedActions = useMemo(() => {
    return allActions.slice().sort((a, b) => {
      const as = selectedActionIds.has(a.id) ? 0 : 1;
      const bs = selectedActionIds.has(b.id) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.action.localeCompare(b.action);
    });
  }, [allActions, selectedActionIds]);

  // Maps for id <-> action bridging with ResourceActionList
  const idToAction = useMemo(
    () => new Map(allActions.map((a) => [String(a.id), a.action])),
    [allActions]
  );
  const actionToId = useMemo(
    () =>
      new Map(allActions.map((a) => [a.action.toLowerCase(), String(a.id)])),
    [allActions]
  );
  const listRef = useRef<ResourceActionListHandle | null>(null);

  const toggleAction = (id: string) => {
    setSelectedActionIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProp = (id: string) => {
    setSelectedPropIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // When any property selected, don't auto-carry activity-level mapped selections
    // (user sees current checkboxes; we leave selectedActionIds as-is)
  };

  const save = useCallback(async () => {
    if (!accessToken) return;
    const act = activityName.trim();
    if (!act) {
      toast.error("Activity is required");
      return;
    }
    if (selectedActionIds.size === 0) {
      toast.error("Select at least one resource action");
      return;
    }
    try {
      setSaving(true);
      if (selectedPropIds.size > 0) {
        // Property-level mapping
        const url = new URL(`/api/activity/targetresourceproperty`, apiBase);
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetResourcePropertyIds: Array.from(selectedPropIds),
            resourceActionIds: Array.from(selectedActionIds),
          }),
        });
        if (!res.ok) throw new Error("Failed to save property mapping");
        toast.success("Property mapping saved");
      } else {
        // Activity-level mapping now requires ActivityId per backend shape
        if (!activityId) {
          toast.error("Select an existing activity to map actions");
          setSaving(false);
          return;
        }
        const url = new URL(`/api/activity`, apiBase);
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activityId: activityId,
            resourceActionIds: Array.from(selectedActionIds),
          }),
        });
        if (!res.ok) throw new Error("Failed to save activity mapping");
        toast.success("Activity mapping saved");
      }
      window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
      onSaved?.(act);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    accessToken,
    apiBase,
    activityName,
    activityId,
    selectedActionIds,
    selectedPropIds,
    onSaved,
    onOpenChange,
  ]);

  if (!open) return null;

  // Simple inline dropdown: input with datalist of existing activities; readonly in edit mode
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !saving && onOpenChange(false)}
      />
      <div className="relative bg-card text-card-foreground w-full max-w-5xl rounded-lg shadow-lg border p-5 space-y-4 animate-in fade-in zoom-in">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Activity mapping</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={
                saving ||
                !accessToken ||
                (selectedPropIds.size === 0 && !activityId)
              }
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        {/* Grid layout */}
        <div className="grid grid-rows-[auto,1fr] gap-3 h-[70vh]">
          {/* Row 1: activity selector */}
          <div className="grid grid-cols-3 items-center gap-3">
            <label className="text-xs text-muted-foreground">Activity</label>
            <div className="col-span-2">
              {mode === "edit" ? (
                <Input
                  value={activityName}
                  readOnly
                  disabled
                  className="text-sm"
                />
              ) : (
                <>
                  <Input
                    list="activity-options"
                    value={activityName}
                    onChange={(e) => setActivityName(e.target.value)}
                    placeholder="Type or pick an activity name"
                  />
                  <datalist id="activity-options">
                    {activities.map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          </div>

          {/* Row 2: two columns */}
          <div className="grid grid-cols-3 gap-4 min-h-0">
            {/* Left column 1/3 width: target resources */}
            <div className="col-span-1 min-h-0 overflow-auto border rounded bg-muted/40 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Target resources
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Select all</span>
                  <Switch
                    checked={selectAllProps}
                    onCheckedChange={(v) => {
                      const next = Boolean(v);
                      setSelectAllProps(next);
                      if (!next) {
                        setSelectedPropIds(new Set());
                        setExpandedTr([]);
                      }
                    }}
                    aria-label="Select all properties"
                  />
                </div>
              </div>
              {targetResources.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No target resources
                </div>
              ) : (
                <Accordion
                  type="multiple"
                  value={expandedTr}
                  onValueChange={(v) => setExpandedTr(v as string[])}
                  className="space-y-2"
                >
                  {targetResources.map((tr) => (
                    <AccordionItem
                      key={tr.resourceType}
                      value={tr.resourceType}
                    >
                      <AccordionTrigger className="text-xs">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{tr.resourceType}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {tr.properties?.length ?? 0} properties
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {(tr.properties || []).map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/60 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedPropIds.has(p.id)}
                                onCheckedChange={() => toggleProp(p.id)}
                                aria-label={`Select ${p.propertyName}`}
                              />
                              <span className="font-mono break-all">
                                {p.propertyName}
                              </span>
                            </label>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>

            {/* Right column 2/3 width: resource actions */}
            <div className="col-span-2 min-h-0 overflow-auto border rounded p-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => listRef.current?.selectAll()}
                    title="Select all currently visible items"
                  >
                    Select all filtered
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => listRef.current?.clearSelection()}
                    title="Clear selected"
                  >
                    Clear
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {selectedPropIds.size > 0
                    ? `Mapping to ${selectedPropIds.size} propert${
                        selectedPropIds.size === 1 ? "y" : "ies"
                      }`
                    : "Mapping to activity"}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mb-1">
                {selectedPropIds.size === 0
                  ? "Checked items indicate actions currently mapped to the activity."
                  : "Pick actions to map to the selected properties."}
              </div>
              {/* Use ResourceActionList for hierarchical, selectable actions */}
              <ResourceActionList
                ref={listRef}
                actions={orderedActions.map((a) => ({
                  action: a.action,
                  description: a.description,
                  isPrivileged: a.isPrivileged,
                }))}
                isSelectable
                selected={Array.from(selectedActionIds)
                  .map((id) => idToAction.get(String(id)))
                  .filter((v): v is string => Boolean(v))}
                onSelectedChange={(names) => {
                  const next = new Set<string>();
                  for (const name of names) {
                    const id = actionToId.get(name.toLowerCase());
                    if (id) next.add(id);
                  }
                  setSelectedActionIds(next);
                }}
              />
              {allActions.length === 0 && (
                <div className="text-xs text-muted-foreground p-2">
                  No actions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ActivityMappingDialog;
