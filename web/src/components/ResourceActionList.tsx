import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ResourceActionPill } from "@/components/ResourceActionPill"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export type ResourceActionLike =
  | string
  | {
      action: string
      id?: string
      isPrivileged?: boolean
      description?: string
    }

export type ResourceActionListProps = {
  actions: ResourceActionLike[]
  className?: string
  searchPlaceholder?: string
  isSelectable?: boolean
  selected?: string[]
  defaultSelected?: string[]
  onSelectedChange?: (selected: string[]) => void
  hideControls?: boolean
  defaultExpanded?: boolean
  compact?: boolean
}

type Parsed = {
  namespace: string
  entity: string
  propertySet: string
  actionName: string
  full: string
}

function parseAction(a: ResourceActionLike): Parsed {
  const full = typeof a === "string" ? a : a.action
  const parts = (full || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)

  const namespace = parts[0] ?? ""
  const entity = parts[1] ?? (parts[0] ?? full)

  let propertySet = "";
  let actionName = "";

  if (parts.length >= 4) {
    // namespace/entity/propertySet/action
    propertySet = parts[2] ?? "";
    actionName = parts[3] ?? "";
  } else if (parts.length === 3) {
    // namespace/entity/action (no property set)
    actionName = parts[2] ?? "";
  } else if (parts.length === 2) {
    // namespace/entity (best-effort)
    actionName = parts[1] ?? "";
  } else {
    actionName = full;
  }

  return { namespace, entity, propertySet, actionName, full }
}

const ALL = "__all__"

export type ResourceActionListHandle = {
  getSelected: () => string[]
  clearSelection: () => void
  selectAll: () => void
}

export const ResourceActionList = React.forwardRef<ResourceActionListHandle, ResourceActionListProps>(function ResourceActionList(
  {
    actions,
    className,
    searchPlaceholder = "Search actions…",
    isSelectable = false,
    selected,
    defaultSelected,
    onSelectedChange,
    hideControls = false,
    defaultExpanded = false,
    compact = false,
  }: ResourceActionListProps,
  ref
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [nsFilter, setNsFilter] = React.useState<string>(ALL);
  const [entityFilter, setEntityFilter] = React.useState<string>(ALL);
  const isControlled = Array.isArray(selected);
  const [internalSelected, setInternalSelected] = React.useState<Set<string>>(
    () => new Set<string>(selected ?? defaultSelected ?? [])
  );

  // Expose imperative handle
  React.useImperativeHandle(ref, () => ({
    getSelected: () =>
      Array.from(isControlled ? new Set(selected) : internalSelected),
    clearSelection: () => {
      const next = new Set<string>();
      if (!isControlled) setInternalSelected(next);
      onSelectedChange?.([]);
    },
    selectAll: () => {
      const all = parsedRef.current.map((p) => p.full);
      const next = new Set(all);
      if (!isControlled) setInternalSelected(next);
      onSelectedChange?.(Array.from(next));
    },
  }));

  // Debounce search
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim().toLowerCase()), 250);
    return () => clearTimeout(h);
  }, [query]);

  // Parse and precompute sets
  const parsed = React.useMemo(() => actions.map(parseAction), [actions]);
  const parsedRef = React.useRef(parsed);
  React.useEffect(() => {
    parsedRef.current = parsed;
  }, [parsed]);

  const namespaces = React.useMemo(() => {
    const set = new Set(parsed.map((p) => p.namespace).filter(Boolean));
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [parsed]);

  const entities = React.useMemo(() => {
    if (nsFilter === ALL) return [ALL];
    const set = new Set(
      parsed
        .filter((p) => p.namespace === nsFilter)
        .map((p) => p.entity)
        .filter(Boolean)
    );
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [parsed, nsFilter]);

  // Filter at action-level first
  const filtered = React.useMemo(() => {
    let list = parsed;
    if (nsFilter !== ALL) list = list.filter((p) => p.namespace === nsFilter);
    if (nsFilter !== ALL && entityFilter !== ALL)
      list = list.filter((p) => p.entity === entityFilter);
    if (debounced) {
      list = list.filter((p) =>
        [p.full, p.entity, p.propertySet, p.actionName, p.namespace]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(debounced))
      );
    }
    return list;
  }, [parsed, nsFilter, entityFilter, debounced]);

  // Build hierarchy: ns -> entity -> { noPS: actions without propertySet, psMap: propertySet -> actions[] }
  const tree = React.useMemo(() => {
    const map = new Map<
      string,
      Map<string, { noPS: Parsed[]; psMap: Map<string, Parsed[]> }>
    >();
    for (const p of filtered) {
      const ns = p.namespace || "(unknown)";
      const ent = p.entity || "(entity)";
      const hasPS = !!p.propertySet;
      if (!map.has(ns)) map.set(ns, new Map());
      const eMap = map.get(ns)!;
      if (!eMap.has(ent)) eMap.set(ent, { noPS: [], psMap: new Map() });
      const bucket = eMap.get(ent)!;
      if (hasPS) {
        const key = p.propertySet as string;
        if (!bucket.psMap.has(key)) bucket.psMap.set(key, []);
        bucket.psMap.get(key)!.push(p);
      } else {
        bucket.noPS.push(p);
      }
    }
    // Optional: sort lists in-place
    for (const [, eMap] of map) {
      for (const [, bucket] of eMap) {
        bucket.noPS.sort((a, b) => a.actionName.localeCompare(b.actionName));
        for (const [, arr] of bucket.psMap)
          arr.sort((a, b) => a.actionName.localeCompare(b.actionName));
      }
    }
    return map;
  }, [filtered]);

  // Sync controlled selection
  React.useEffect(() => {
    if (isControlled) {
      // Replace internal snapshot to reflect controlled changes
      setInternalSelected(new Set(selected));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, selected?.length, selected && selected.join("|")]);

  const selectedSet = isControlled ? new Set(selected) : internalSelected;

  const updateSelected = (next: Set<string>) => {
    if (!isControlled) setInternalSelected(next);
    onSelectedChange?.(Array.from(next));
  };

  // Helpers to collect leaves under a level
  const leavesUnderNamespace = React.useCallback(
    (ns: string) => {
      const eMap = tree.get(ns);
      if (!eMap) return [] as string[];
      const out: string[] = [];
      for (const [, bucket] of eMap) {
        for (const p of bucket.noPS) out.push(p.full);
        for (const [, arr] of bucket.psMap)
          for (const p of arr) out.push(p.full);
      }
      return out;
    },
    [tree]
  );

  const leavesUnderEntity = React.useCallback(
    (ns: string, ent: string) => {
      const eMap = tree.get(ns);
      if (!eMap) return [] as string[];
      const bucket = eMap.get(ent);
      if (!bucket) return [];
      const out: string[] = [];
      for (const p of bucket.noPS) out.push(p.full);
      for (const [, arr] of bucket.psMap) for (const p of arr) out.push(p.full);
      return out;
    },
    [tree]
  );

  const leavesUnderPropertySet = React.useCallback(
    (ns: string, ent: string, ps: string) => {
      const eMap = tree.get(ns);
      if (!eMap) return [] as string[];
      const bucket = eMap.get(ent);
      if (!bucket) return [];
      const arr = bucket.psMap.get(ps) ?? [];
      return arr.map((p) => p.full);
    },
    [tree]
  );

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col", compact ? "gap-2" : "gap-3", className)}
    >
      {/* Controls */}
      {!hideControls && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={nsFilter}
            onValueChange={(v) => {
              setNsFilter(v);
              setEntityFilter(ALL);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Namespace" />
            </SelectTrigger>
            <SelectContent container={containerRef.current}>
              <SelectItem value={ALL}>Show all</SelectItem>
              {namespaces
                .filter((n) => n !== ALL)
                .map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={entityFilter}
            onValueChange={setEntityFilter}
            disabled={nsFilter === ALL}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent container={containerRef.current}>
              <SelectItem value={ALL}>Show all</SelectItem>
              {entities
                .filter((e) => e !== ALL)
                .map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Hierarchical list */}
      <div
        className={cn(
          "border rounded bg-card text-card-foreground max-h-[60vh] overflow-auto",
          compact ? "p-1.5" : "p-2"
        )}
      >
        {filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No matching actions
          </div>
        ) : (
          <Accordion
            type="multiple"
            className="w-full"
            defaultValue={
              defaultExpanded
                ? Array.from(tree.keys()).map((ns) => `ns:${ns}`)
                : undefined
            }
          >
            {Array.from(tree.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ns, eMap]) => (
                <AccordionItem key={ns} value={`ns:${ns}`}>
                  <AccordionTrigger className={cn("px-2", compact && "px-1.5")}>
                    <div className="flex items-center gap-2">
                      {isSelectable &&
                        (() => {
                          const leafs = leavesUnderNamespace(ns);
                          const selectedCount = leafs.reduce(
                            (n, f) => n + (selectedSet.has(f) ? 1 : 0),
                            0
                          );
                          const state =
                            selectedCount === 0
                              ? false
                              : selectedCount === leafs.length
                              ? true
                              : "indeterminate";
                          return (
                            <Checkbox
                              checked={state as any}
                              onCheckedChange={(v) => {
                                const next = new Set(selectedSet);
                                if (v) leafs.forEach((f) => next.add(f));
                                else leafs.forEach((f) => next.delete(f));
                                updateSelected(next);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select all in ${ns}`}
                            />
                          );
                        })()}
                      <span className="font-medium">{ns}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {Array.from(eMap.values()).reduce(
                          (n, bucket) =>
                            n +
                            bucket.noPS.length +
                            Array.from(bucket.psMap.values()).reduce(
                              (m, arr) => m + arr.length,
                              0
                            ),
                          0
                        )}{" "}
                        actions
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Accordion
                      type="multiple"
                      className="ml-3 border-l pl-2"
                      defaultValue={
                        defaultExpanded
                          ? Array.from(eMap.keys()).map(
                              (ent) => `ent:${ns}|${ent}`
                            )
                          : undefined
                      }
                    >
                      {Array.from(eMap.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([ent, bucket]) => (
                          <AccordionItem
                            key={`${ns}|${ent}`}
                            value={`ent:${ns}|${ent}`}
                          >
                            <AccordionTrigger
                              className={cn("px-2", compact && "px-1.5")}
                            >
                              <div className="flex items-center gap-2">
                                {isSelectable &&
                                  (() => {
                                    const leafs = leavesUnderEntity(ns, ent);
                                    const selectedCount = leafs.reduce(
                                      (n, f) =>
                                        n + (selectedSet.has(f) ? 1 : 0),
                                      0
                                    );
                                    const state =
                                      selectedCount === 0
                                        ? false
                                        : selectedCount === leafs.length
                                        ? true
                                        : "indeterminate";
                                    return (
                                      <Checkbox
                                        checked={state as any}
                                        onCheckedChange={(v) => {
                                          const next = new Set(selectedSet);
                                          if (v)
                                            leafs.forEach((f) => next.add(f));
                                          else
                                            leafs.forEach((f) =>
                                              next.delete(f)
                                            );
                                          updateSelected(next);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={`Select all in ${ns}/${ent}`}
                                      />
                                    );
                                  })()}
                                <span>{ent}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {bucket.noPS.length +
                                    Array.from(bucket.psMap.values()).reduce(
                                      (m, arr) => m + arr.length,
                                      0
                                    )}{" "}
                                  actions
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="ml-3 border-l pl-2">
                                {/* Render actions without property set directly under the entity */}
                                {bucket.noPS.length > 0 && (
                                  <ul
                                    className={cn(
                                      "ml-2",
                                      compact ? "space-y-0.5" : "space-y-1"
                                    )}
                                  >
                                    {bucket.noPS.map((p, i) => (
                                      <li
                                        key={`${p.full}-${i}`}
                                        className={cn(
                                          "flex items-center",
                                          compact ? "gap-1.5" : "gap-2"
                                        )}
                                      >
                                        {isSelectable && (
                                          <Checkbox
                                            checked={selectedSet.has(p.full)}
                                            onCheckedChange={(v) => {
                                              const next = new Set(selectedSet);
                                              if (v) next.add(p.full);
                                              else next.delete(p.full);
                                              updateSelected(next);
                                            }}
                                            aria-label={`Select ${p.full}`}
                                          />
                                        )}
                                        <ResourceActionPill
                                          action={p.full}
                                          size="sm"
                                          compact
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {/* Render property set groups normally */}
                                {bucket.psMap.size > 0 && (
                                  <Accordion
                                    type="multiple"
                                    defaultValue={
                                      defaultExpanded
                                        ? Array.from(bucket.psMap.keys()).map(
                                            (ps) => `ps:${ns}|${ent}|${ps}`
                                          )
                                        : undefined
                                    }
                                  >
                                    {Array.from(bucket.psMap.entries())
                                      .sort(([a], [b]) => a.localeCompare(b))
                                      .map(([ps, arr]) => (
                                        <AccordionItem
                                          key={`${ns}|${ent}|${ps}`}
                                          value={`ps:${ns}|${ent}|${ps}`}
                                        >
                                          <AccordionTrigger
                                            className={cn(
                                              "px-2",
                                              compact && "px-1.5"
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              {isSelectable &&
                                                (() => {
                                                  const leafs =
                                                    leavesUnderPropertySet(
                                                      ns,
                                                      ent,
                                                      ps
                                                    );
                                                  const selectedCount =
                                                    leafs.reduce(
                                                      (n, f) =>
                                                        n +
                                                        (selectedSet.has(f)
                                                          ? 1
                                                          : 0),
                                                      0
                                                    );
                                                  const state =
                                                    selectedCount === 0
                                                      ? false
                                                      : selectedCount ===
                                                        leafs.length
                                                      ? true
                                                      : "indeterminate";
                                                  return (
                                                    <Checkbox
                                                      checked={state as any}
                                                      onCheckedChange={(v) => {
                                                        const next = new Set(
                                                          selectedSet
                                                        );
                                                        if (v)
                                                          leafs.forEach((f) =>
                                                            next.add(f)
                                                          );
                                                        else
                                                          leafs.forEach((f) =>
                                                            next.delete(f)
                                                          );
                                                        updateSelected(next);
                                                      }}
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                      aria-label={`Select all in ${ns}/${ent}/${ps}`}
                                                    />
                                                  );
                                                })()}
                                              <span className="text-sm">
                                                {ps}
                                              </span>
                                              <span className="text-[10px] text-muted-foreground">
                                                {arr.length} actions
                                              </span>
                                            </div>
                                          </AccordionTrigger>
                                          <AccordionContent>
                                            <ul
                                              className={cn(
                                                "ml-2",
                                                compact
                                                  ? "space-y-0.5"
                                                  : "space-y-1"
                                              )}
                                            >
                                              {arr.map((p, i) => (
                                                <li
                                                  key={`${p.full}-${i}`}
                                                  className={cn(
                                                    "flex items-center",
                                                    compact
                                                      ? "gap-1.5"
                                                      : "gap-2"
                                                  )}
                                                >
                                                  {isSelectable && (
                                                    <Checkbox
                                                      checked={selectedSet.has(
                                                        p.full
                                                      )}
                                                      onCheckedChange={(v) => {
                                                        const next = new Set(
                                                          selectedSet
                                                        );
                                                        if (v) next.add(p.full);
                                                        else
                                                          next.delete(p.full);
                                                        updateSelected(next);
                                                      }}
                                                      aria-label={`Select ${p.full}`}
                                                    />
                                                  )}
                                                  <ResourceActionPill
                                                    action={p.full}
                                                    size="sm"
                                                    compact
                                                  />
                                                </li>
                                              ))}
                                            </ul>
                                          </AccordionContent>
                                        </AccordionItem>
                                      ))}
                                  </Accordion>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        )}
      </div>
    </div>
  );
})

export default ResourceActionList
