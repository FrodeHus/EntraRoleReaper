import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RolesTab } from "./config/RolesTab";
import { RoleDetailsSheet } from "../review/RoleDetailsSheet";
import ActivityMappingDialog from "./config/ActivityMappingDialog";
import { OperationMappingSheet } from "../review/OperationMappingSheet";
import type { RoleDetails } from "../review/types";

export function RolesPage({
  accessToken,
  apiBase,
}: {
  accessToken: string | null;
  apiBase: string;
}) {
  // Roles state
  const [selectedRole, setSelectedRole] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [roleDetailsOpen, setRoleDetailsOpen] = useState(false);
  const [roleDetailsLoading, setRoleDetailsLoading] = useState(false);
  const [roleDetails, setRoleDetails] = useState<RoleDetails | null>(null);

  // Mapping modal state (same behavior as in ConfigPage)
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingModalMode, setMappingModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [mappingModalName, setMappingModalName] = useState<string | null>(null);
  const [preselectedActionIds, setPreselectedActionIds] = useState<
    string[] | null
  >(null);
  const [opSheetOpen, setOpSheetOpen] = useState(false);
  const [opSheetOperationName, setOpSheetOperationName] = useState<
    string | null
  >(null);

  // Listen for open-op-mapping events triggered by RoleDetailsSheet actions
  useEffect(() => {
    const openHandler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as {
          operationName?: string;
          mapActivity?: boolean;
          preselectedActionNames?: string[];
          preselectedActionIds?: string[];
        };
        if (detail?.operationName) {
          setOpSheetOperationName(detail.operationName);
          setOpSheetOpen(true);
        }
        if (detail?.mapActivity) {
          (async () => {
            try {
              // Prefer IDs if provided; else resolve names
              let ids: string[] = detail.preselectedActionIds ?? [];
              if ((!ids || ids.length === 0) && detail.preselectedActionNames) {
                const names = detail.preselectedActionNames;
                ids = [];
                for (const name of names) {
                  if (!accessToken) continue;
                  const url = new URL(`/api/resourceaction/search`, apiBase);
                  url.searchParams.set("q", name);
                  url.searchParams.set("limit", "50");
                  const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (!res.ok) continue;
                  const arr = (await res.json()) as Array<{
                    id: string;
                    action: string;
                    isPrivileged: boolean;
                  }>;
                  const match = arr.find(
                    (a) => a.action.toLowerCase() === name.toLowerCase()
                  );
                  if (match) ids.push(match.id);
                }
              }
              setMappingModalMode("create");
              setMappingModalName(null);
              setPreselectedActionIds(ids);
              setMappingModalOpen(true);
            } catch {
              setMappingModalMode("create");
              setMappingModalName(null);
              setPreselectedActionIds(null);
              setMappingModalOpen(true);
            }
          })();
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("open-op-mapping", openHandler as any);
    return () =>
      window.removeEventListener("open-op-mapping", openHandler as any);
  }, [accessToken, apiBase]);

  // Fetch role details when a role is selected (opened)
  useEffect(() => {
    const fetchDetails = async () => {
      if (!selectedRole || !roleDetailsOpen || !accessToken) return;
      try {
        setRoleDetailsLoading(true);
        setRoleDetails(null);
        const res = await fetch(
          new URL(`/api/roles/${encodeURIComponent(selectedRole.id)}`, apiBase),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!res.ok) throw new Error();
        const json = await res.json();
        setRoleDetails(json as RoleDetails);
      } catch {
        toast.error("Failed to load role details");
        setRoleDetails(null);
      } finally {
        setRoleDetailsLoading(false);
      }
    };
    fetchDetails();
  }, [selectedRole, roleDetailsOpen, accessToken, apiBase]);

  return (
    <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
      <h2 className="text-sm font-medium tracking-wide">Roles</h2>
      <RolesTab
        accessToken={accessToken}
        apiBase={apiBase}
        onOpenRole={(id, name) => {
          setSelectedRole({ id, name });
          setRoleDetailsOpen(true);
        }}
      />
      <RoleDetailsSheet
        open={roleDetailsOpen}
        onOpenChange={(o) => {
          setRoleDetailsOpen(o);
          if (!o) {
            setSelectedRole(null);
            setRoleDetails(null);
          }
        }}
        role={
          selectedRole ? { name: selectedRole.name, requiredPerms: [] } : null
        }
        details={
          roleDetails ||
          ({
            name: selectedRole?.name || "",
            description: "",
            resourceScopes: [],
            resourceScopesDetailed: [],
            rolePermissions: [],
          } as any)
        }
        loading={roleDetailsLoading}
      />
      <ActivityMappingDialog
        open={mappingModalOpen}
        onOpenChange={(o) => {
          setMappingModalOpen(o);
          if (!o) {
            setPreselectedActionIds(null);
          }
        }}
        accessToken={accessToken}
        apiBase={apiBase}
        initialActivityName={mappingModalName}
        mode={mappingModalMode}
        preselectedIds={preselectedActionIds ?? undefined}
        onSaved={() => {
          window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
        }}
      />
      <OperationMappingSheet
        open={opSheetOpen}
        onOpenChange={(o) => setOpSheetOpen(o)}
        operationName={opSheetOperationName}
        accessToken={accessToken}
        apiBase={apiBase}
      />
    </section>
  );
}

export default RolesPage;
