import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
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
  parseActionParts: _parseActionParts,
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
        <div className="flex gap-2 items-center text-[10px]">
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
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No actions found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.length > 0 &&
              items.map((a) => {
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
