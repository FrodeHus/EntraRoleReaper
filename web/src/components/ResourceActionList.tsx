import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TreeView, type TreeDataItem } from "@/components/tree-view";
import { ResourceActionPill } from "@/components/ResourceActionPill";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ResourceActionLike =
  | string
  | {
      action: string;
      id?: string;
      isPrivileged?: boolean;
      description?: string;
    };

export type ResourceActionListProps = {
  actions: ResourceActionLike[];
  className?: string;
  searchPlaceholder?: string;
  isSelectable?: boolean;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  hideControls?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean;
};

type Parsed = {
  namespace: string;
  entity: string;
  propertySet: string;
  actionName: string;
  full: string;
  isPrivileged?: boolean;
  description?: string;
};

function parseAction(a: ResourceActionLike): Parsed {
  const full = typeof a === "string" ? a : a.action;
  const isPrivileged = typeof a === "string" ? undefined : a.isPrivileged;
  const description = typeof a === "string" ? undefined : a.description;
  const parts = (full || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  const namespace = parts[0] ?? "";
  const entity = parts[1] ?? parts[0] ?? full;

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

  return {
    namespace,
    entity,
    propertySet,
    actionName,
    full,
    isPrivileged,
    description,
  };
}

const PrivBadge: React.FC = () => (
  <span className="ml-2 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] bg-destructive/10 text-destructive border-destructive/30">
    Privileged
  </span>
);

const ALL = "__all__";

export type ResourceActionListHandle = {
  getSelected: () => string[];
  clearSelection: () => void;
  selectAll: () => void;
};

export const ResourceActionList = React.forwardRef<
  ResourceActionListHandle,
  ResourceActionListProps
>(function ResourceActionList(
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

  // Build hierarchy for TreeView data
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
    (ns: string): string[] => {
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
    (ns: string, ent: string): string[] => {
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
    (ns: string, ent: string, ps: string): string[] => {
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

      {/* Hierarchical list using TreeView */}
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
          <TreeView
            data={Array.from(tree.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ns, eMap]) => {
                const nsLeafs = leavesUnderNamespace(ns);
                const nsSelectedCount = nsLeafs.reduce(
                  (n: number, f: string) => n + (selectedSet.has(f) ? 1 : 0),
                  0
                );
                const nsState =
                  nsSelectedCount === 0
                    ? false
                    : nsSelectedCount === nsLeafs.length
                    ? true
                    : "indeterminate";
                const nsHasPrivileged = Array.from(eMap.values()).some(
                  (bucket) =>
                    bucket.noPS.some((p) => !!p.isPrivileged) ||
                    Array.from(bucket.psMap.values()).some((arr) =>
                      arr.some((p) => !!p.isPrivileged)
                    )
                );
                const nsName = (
                  <div className="flex items-center gap-2">
                    {isSelectable && (
                      <Checkbox
                        checked={nsState as any}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedSet);
                          if (v) nsLeafs.forEach((f) => next.add(f));
                          else nsLeafs.forEach((f) => next.delete(f));
                          updateSelected(next);
                        }}
                        aria-label={`Select all in ${ns}`}
                      />
                    )}
                    <span className="font-medium">{ns}</span>
                    {nsHasPrivileged && <PrivBadge />}
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
                );

                const entityNodes: TreeDataItem[] = Array.from(eMap.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([ent, bucket]) => {
                    const entLeafs = leavesUnderEntity(ns, ent);
                    const entSelectedCount = entLeafs.reduce(
                      (n: number, f: string) =>
                        n + (selectedSet.has(f) ? 1 : 0),
                      0
                    );
                    const entState =
                      entSelectedCount === 0
                        ? false
                        : entSelectedCount === entLeafs.length
                        ? true
                        : "indeterminate";
                    const entHasPrivileged =
                      bucket.noPS.some((p) => !!p.isPrivileged) ||
                      Array.from(bucket.psMap.values()).some((arr) =>
                        arr.some((p) => !!p.isPrivileged)
                      );
                    const entName = (
                      <div className="flex items-center gap-2">
                        {isSelectable && (
                          <Checkbox
                            checked={entState as any}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedSet);
                              if (v) entLeafs.forEach((f) => next.add(f));
                              else entLeafs.forEach((f) => next.delete(f));
                              updateSelected(next);
                            }}
                            aria-label={`Select all in ${ns}/${ent}`}
                          />
                        )}
                        <span>{ent}</span>
                        {entHasPrivileged && <PrivBadge />}
                        <span className="text-[10px] text-muted-foreground">
                          {bucket.noPS.length +
                            Array.from(bucket.psMap.values()).reduce(
                              (m, arr) => m + arr.length,
                              0
                            )}{" "}
                          actions
                        </span>
                      </div>
                    );

                    const children: TreeDataItem[] = [];
                    // Direct actions (no property set)
                    for (const p of bucket.noPS) {
                      children.push({
                        id: `act:${p.full}`,
                        name: (
                          <div
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
                              description={p.description}
                              isPrivileged={p.isPrivileged}
                              size="sm"
                              compact
                            />
                          </div>
                        ),
                      });
                    }

                    // Property set groups
                    for (const [ps, arr] of Array.from(
                      bucket.psMap.entries()
                    ).sort(([a], [b]) => a.localeCompare(b))) {
                      const psLeafs = leavesUnderPropertySet(ns, ent, ps);
                      const psSelectedCount = psLeafs.reduce(
                        (n: number, f: string) =>
                          n + (selectedSet.has(f) ? 1 : 0),
                        0
                      );
                      const psState =
                        psSelectedCount === 0
                          ? false
                          : psSelectedCount === psLeafs.length
                          ? true
                          : "indeterminate";
                      const psHasPrivileged = arr.some((p) => !!p.isPrivileged);
                      children.push({
                        id: `ps:${ns}|${ent}|${ps}`,
                        name: (
                          <div className="flex items-center gap-2">
                            {isSelectable && (
                              <Checkbox
                                checked={psState as any}
                                onCheckedChange={(v) => {
                                  const next = new Set(selectedSet);
                                  if (v) psLeafs.forEach((f) => next.add(f));
                                  else psLeafs.forEach((f) => next.delete(f));
                                  updateSelected(next);
                                }}
                                aria-label={`Select all in ${ns}/${ent}/${ps}`}
                              />
                            )}
                            <span className="text-sm">{ps}</span>
                            {psHasPrivileged && <PrivBadge />}
                            <span className="text-[10px] text-muted-foreground">
                              {arr.length} actions
                            </span>
                          </div>
                        ),
                        children: arr.map((p, i) => ({
                          id: `act:${p.full}-${i}`,
                          name: (
                            <div
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
                                description={p.description}
                                isPrivileged={p.isPrivileged}
                                size="sm"
                                compact
                              />
                            </div>
                          ),
                        })),
                      });
                    }

                    return {
                      id: `ent:${ns}|${ent}`,
                      name: entName,
                      children,
                    };
                  });

                return {
                  id: `ns:${ns}`,
                  name: nsName,
                  children: entityNodes,
                };
              })}
            expandAll={defaultExpanded}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
});

export default ResourceActionList
