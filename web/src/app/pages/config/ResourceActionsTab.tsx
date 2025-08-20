import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

export interface ResourceActionItem {
  id: string;
  action: string;
  isPrivileged: boolean;
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
  parseActionParts: (action: string) => { namespace: string; resourceType: string };
}) {
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
          <Button size="sm" variant="outline" onClick={onToggleDir} disabled={loading} title="Toggle sort direction">
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
        </div>
      </div>
      <div className="border rounded h-[55vh] overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-transparent">Namespace</TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">Resource Type</TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">Privileged</TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">Loading actions…</TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">No actions found.</TableCell>
              </TableRow>
            )}
            {!loading &&
              items.length > 0 &&
              items.map((a) => {
                const { namespace, resourceType } = parseActionParts(a.action);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-0">
                      <span className="truncate" title={namespace}>{namespace || ""}</span>
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="truncate" title={resourceType}>{resourceType || ""}</span>
                    </TableCell>
                    <TableCell>
                      {a.isPrivileged ? (
                        <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">Privileged</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span className="font-mono truncate block" title={a.action}>{a.action}</span>
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
