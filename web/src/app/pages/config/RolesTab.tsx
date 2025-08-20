import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

export interface RoleItem {
  id: string;
  displayName: string;
  isBuiltIn?: boolean;
  permissionSets?: Array<{
    resourceActions?: Array<{ isPrivileged?: boolean }>;
  }>;
  PermissionSets?: Array<{
    ResourceActions?: Array<{ IsPrivileged?: boolean }>;
  }>;
}

export function RolesTab({
  accessToken,
  apiBase,
  onOpenRole,
}: {
  accessToken: string | null;
  apiBase: string;
  onOpenRole: (id: string, name: string) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [privOnly, setPrivOnly] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    try {
      setLoading(true);
      const url = new URL("/api/roles/summary", apiBase);
      url.searchParams.set("page", "1");
      url.searchParams.set("pageSize", "500");
      if (privOnly) url.searchParams.set("privilegedOnly", "true");
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list = (json?.roles ?? json?.items ?? []) as any[];
      const isRolePrivileged = (r: any) =>
        ((r.permissionSets || r.PermissionSets) ?? []).some((ps: any) =>
          ((ps.resourceActions || ps.ResourceActions) ?? []).some(
            (ra: any) => ra.isPrivileged === true || ra.IsPrivileged === true
          )
        );
      const filtered = privOnly ? list.filter(isRolePrivileged) : list;
      filtered.sort((a: any, b: any) =>
        String(a.displayName || a.DisplayName || "")
          .toLowerCase()
          .localeCompare(
            String(b.displayName || b.DisplayName || "").toLowerCase()
          )
      );
      setItems(filtered);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase, privOnly]);

  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between">
        <h3 className="text-sm font-medium">Role definitions</h3>
        <Button
          size="sm"
          variant={privOnly ? "default" : "outline"}
          onClick={() => setPrivOnly((v) => !v)}
          disabled={!accessToken || loading}
        >
          {privOnly ? "Showing privileged" : "Privileged only"}
        </Button>
      </div>
      <div className="border rounded h-[55vh] overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-transparent">
                Role
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">
                Privileged
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-transparent">
                Type
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Loading roles…
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No roles found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.length > 0 &&
              items.map((r: any) => {
                const id = r.id || r.Id;
                const name = r.displayName || r.DisplayName;
                const isPriv = (
                  (r.permissionSets || r.PermissionSets) ??
                  []
                ).some((ps: any) =>
                  (
                    ((ps.resourceActions || ps.ResourceActions) ?? []) as any[]
                  ).some(
                    (ra: any) =>
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
                        <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                          Privileged
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground">
                        {type}
                      </span>
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
