import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

export interface RoleItem {
  id: string;
  displayName: string;
  isBuiltIn?: boolean;
  permissionSets?: Array<{ resourceActions?: Array<{ isPrivileged?: boolean }> }>;
  PermissionSets?: Array<{ ResourceActions?: Array<{ IsPrivileged?: boolean }> }>;
}

export function RolesTab({
  accessToken,
  items,
  loading,
  privOnly,
  onTogglePrivOnly,
  onOpenRole,
}: {
  accessToken: string | null;
  items: any[];
  loading: boolean;
  privOnly: boolean;
  onTogglePrivOnly: () => void;
  onOpenRole: (id: string, name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between">
        <h3 className="text-sm font-medium">Role definitions</h3>
        <Button size="sm" variant={privOnly ? "default" : "outline"} onClick={onTogglePrivOnly} disabled={!accessToken || loading}>
          {privOnly ? "Showing privileged" : "Privileged only"}
        </Button>
      </div>
      <div className="border rounded h-[55vh] overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-transparent">Role</TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">Privileged</TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">Loading roles…</TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">No roles found.</TableCell>
              </TableRow>
            )}
            {!loading &&
              items.length > 0 &&
              items.map((r: any) => {
                const id = r.id || r.Id;
                const name = r.displayName || r.DisplayName;
                const isPriv = ((r.permissionSets || r.PermissionSets) ?? []).some((ps: any) =>
                  (((ps.resourceActions || ps.ResourceActions) ?? []) as any[]).some((ra: any) =>
                    ra.isPrivileged === true || ra.IsPrivileged === true
                  )
                );
                const type = r.isBuiltIn === true ? "Built-in" : "Custom";
                return (
                  <TableRow key={id}>
                    <TableCell className="max-w-0">
                      <button
                        className="font-semibold text-left hover:underline truncate"
                        title={name}
                        onClick={() => onOpenRole(id, name)}
                      >
                        {name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {isPriv ? (
                        <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">Privileged</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground">{type}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
