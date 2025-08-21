import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MappingsTab } from "./config/MappingsTab";
import ActivityMappingModal from "../review/ActivityMappingModal";
import { OperationMappingSheet } from "../review/OperationMappingSheet";

export function MappingsPage({
  accessToken,
  apiBase,
}: {
  accessToken: string | null;
  apiBase: string;
}) {
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

  const deletePropertyMap = useCallback(
    async (activityName: string, propertyName: string) => {
      if (!accessToken) return;
      try {
        const res = await fetch(new URL("/api/activity/property", apiBase), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ activityName, propertyName }),
        });
        if (!res.ok) throw new Error();
        toast.success("Property mapping deleted", {
          description: `${activityName}::${propertyName}`,
        });
        window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
      } catch {
        toast.error("Failed to delete property mapping");
      }
    },
    [accessToken, apiBase]
  );

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

  return (
    <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
      <h2 className="text-sm font-medium tracking-wide">Mappings</h2>
      <MappingsTab
        accessToken={accessToken}
        apiBase={apiBase}
        onCreate={() => {
          setMappingModalMode("create");
          setMappingModalName(null);
          setMappingModalOpen(true);
        }}
        onEditBase={(name) => {
          setMappingModalMode("edit");
          setMappingModalName(name);
          setMappingModalOpen(true);
        }}
        onEditProperty={(op, prop) => {
          setOpSheetOperationName(`${op}::${prop}`);
          setOpSheetOpen(true);
        }}
        onDeleteProperty={(op, prop) => deletePropertyMap(op, prop)}
      />

      <ActivityMappingModal
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

export default MappingsPage;
