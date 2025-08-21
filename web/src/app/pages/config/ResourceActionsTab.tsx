import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

export interface ResourceActionItem {
  id: string;
  action: string;
  isPrivileged: boolean;
  mappedCount?: number;
}

export function ResourceActionsTab({
  accessToken,
  searchInput,
  loading,
  items,
  sort,
  dir,
  privFilter,
  onSearchInput,
  onToggleDir,
  onSort,
  onPrivFilter,
  parseActionParts,
  onMapSelected,
}: {
  accessToken: string | null;
  searchInput: string;
  loading: boolean;
  items: ResourceActionItem[];
  sort: "action" | "roles" | "privileged";
  dir: "asc" | "desc";
  privFilter: "all" | "priv" | "nonpriv";
  onSearchInput: (v: string) => void;
  onToggleDir: () => void;
  onSort: (v: "action" | "roles" | "privileged") => void;
  onPrivFilter: (v: "all" | "priv" | "nonpriv") => void;
  parseActionParts: (action: string) => {
    namespace: string;
    resourceType: string;
  };
  onMapSelected?: (ids: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set()
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );
  const currentIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  useEffect(() => {
    // Prune selections that are no longer visible
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [currentIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMap = () => {
    if (!onMapSelected) return;
    onMapSelected(Array.from(selectedIds));
  };

  // Build distinct Service and Category values from current items
  const { services, categories } = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    for (const it of items) {
      const parts = parseActionParts(it.action);
      const service = (parts.namespace || "").trim();
      const category = (parts.resourceType || "").trim();
      if (service) s.add(service);
      if (category) c.add(category);
    }
    return {
      services: Array.from(s).sort((a, b) => a.localeCompare(b)),
      categories: Array.from(c).sort((a, b) => a.localeCompare(b)),
    };
  }, [items, parseActionParts]);

  // Apply filters to items for rendering
  const filteredItems = useMemo(() => {
    const hasServiceFilter = selectedServices.size > 0;
    const hasCategoryFilter = selectedCategories.size > 0;
    if (!hasServiceFilter && !hasCategoryFilter) return items;
    return items.filter((it) => {
      const parts = parseActionParts(it.action);
      const service = (parts.namespace || "").trim();
      const category = (parts.resourceType || "").trim();
      if (hasServiceFilter && !selectedServices.has(service)) return false;
      if (hasCategoryFilter && !selectedCategories.has(category)) return false;
      return true;
    });
  }, [items, selectedServices, selectedCategories, parseActionParts]);

  const toggleService = (name: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const clearFilters = () => {
    setSelectedServices(new Set());
    setSelectedCategories(new Set());
  };
  const removeService = (name: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };
  const removeCategory = (name: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search actions"
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
            className="border rounded px-2 py-1 pr-6 text-xs w-full bg-background"
            disabled={!accessToken}
            aria-label="Search actions or roles"
          />
        </div>
        <div className="flex gap-2 items-center text-[10px] relative">
          <select
            className="border rounded px-1 py-1 bg-background"
            value={sort}
            onChange={(e) => onSort(e.target.value as any)}
            disabled={loading}
            aria-label="Sort by"
          >
            <option value="action">Action</option>
            <option value="roles">Role count</option>
            <option value="privileged">Privileged</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleDir}
            disabled={loading}
            title="Toggle sort direction"
          >
            {dir === "asc" ? "Asc" : "Desc"}
          </Button>
          <select
            className="border rounded px-1 py-1 bg-background"
            value={privFilter}
            onChange={(e) => onPrivFilter(e.target.value as any)}
            disabled={loading}
            aria-label="Privilege filter"
          >
            <option value="all">All</option>
            <option value="priv">Privileged</option>
            <option value="nonpriv">Non-privileged</option>
          </select>
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => setOpenFilter((v) => !v)}
              title="Filter by Service/Category"
            >
              Filter
              {selectedServices.size + selectedCategories.size > 0 && (
                <span className="ml-1 px-1 rounded border bg-muted text-muted-foreground text-[10px]">
                  {selectedServices.size + selectedCategories.size}
                </span>
              )}
            </Button>
            {openFilter && (
              <div className="absolute right-0 mt-1 z-20 w-72 max-h-80 overflow-auto border rounded bg-popover text-popover-foreground shadow">
                <div className="p-2 border-b text-[11px] font-medium">
                  Service
                </div>
                <div className="p-2 space-y-1">
                  {services.length === 0 && (
                    <div className="text-muted-foreground text-[11px]">
                      No services
                    </div>
                  )}
                  {services.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 text-[11px] cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedServices.has(s)}
                        onCheckedChange={() => toggleService(s)}
                      />
                      <span className="truncate" title={s}>
                        {s}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="p-2 border-t border-b text-[11px] font-medium">
                  Category
                </div>
                <div className="p-2 space-y-1">
                  {categories.length === 0 && (
                    <div className="text-muted-foreground text-[11px]">
                      No categories
                    </div>
                  )}
                  {categories.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 text-[11px] cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCategories.has(c)}
                        onCheckedChange={() => toggleCategory(c)}
                      />
                      <span className="truncate" title={c}>
                        {c}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="p-2 flex gap-2 justify-end border-t">
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={() => setOpenFilter(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleMap}
            disabled={loading || selectedIds.size === 0}
            title="Map selected actions"
          >
            Map
          </Button>
        </div>
      </div>
      {selectedServices.size + selectedCategories.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {Array.from(selectedServices).map((s) => (
            <span
              key={`svc:${s}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 bg-muted text-muted-foreground"
            >
              <span className="font-medium text-foreground/80">Service:</span>
              <span className="font-mono">{s}</span>
              <button
                className="ml-1 hover:text-foreground"
                aria-label={`Remove service filter ${s}`}
                onClick={() => removeService(s)}
              >
                ✕
              </button>
            </span>
          ))}
          {Array.from(selectedCategories).map((c) => (
            <span
              key={`cat:${c}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 bg-muted text-muted-foreground"
            >
              <span className="font-medium text-foreground/80">Category:</span>
              <span className="font-mono">{c}</span>
              <button
                className="ml-1 hover:text-foreground"
                aria-label={`Remove category filter ${c}`}
                onClick={() => removeCategory(c)}
              >
                ✕
              </button>
            </span>
          ))}
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}
      <div className="border rounded h-[55vh] overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-transparent w-10">
                Select
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">
                Action
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent text-right">
                Mapped activities
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Loading actions…
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No actions found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filteredItems.length > 0 &&
              filteredItems.map((a) => {
                return (
                  <TableRow key={a.id}>
                    <TableCell className="align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select ${a.action}`}
                        checked={selectedIds.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="align-top text-left">
                      <div className="flex items-start gap-2">
                        <div className="w-24">
                          {a.isPrivileged ? (
                            <span className="inline-block text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                              Privileged
                            </span>
                          ) : (
                            <span
                              className="inline-block w-0"
                              aria-hidden="true"
                            ></span>
                          )}
                        </div>
                        <span
                          className="font-mono block whitespace-normal break-all"
                          title={a.action}
                        >
                          {a.action}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {typeof a.mappedCount === "number" ? a.mappedCount : 0}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2 justify-end text-[10px]">
        <span>Page 1 / 1</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled onClick={() => {}}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled onClick={() => {}}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
