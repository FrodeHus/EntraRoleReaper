import { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { RoleDetailsSheet } from "../review/RoleDetailsSheet";
import type { RoleDetails } from "../review/types";
import ActivityMappingModal from "../review/ActivityMappingModal";
import { OperationMappingSheet } from "../review/OperationMappingSheet";
import { CacheTab } from "./config/CacheTab";
import { MappingsTab } from "./config/MappingsTab";
import { ExclusionsTab } from "./config/ExclusionsTab";
import { ResourceActionsTab } from "./config/ResourceActionsTab";
import { RolesTab } from "./config/RolesTab";
import { FutureTab } from "./config/FutureTab";

// Simple tab primitives (could be replaced with a UI lib tabs in future)
interface TabConfig {
  key: string;
  label: string;
}
const tabs: TabConfig[] = [
  { key: "cache", label: "Cache" },
  { key: "mappings", label: "Mappings" },
  { key: "exclusions", label: "Exclusions" },
  { key: "roles", label: "Roles" },
  { key: "actions", label: "Resource Actions" },
  { key: "future", label: "Upcoming" },
];

interface ConfigPageProps {
  accessToken: string | null;
  apiBase: string;
}

export function ConfigPage({ accessToken, apiBase }: ConfigPageProps) {
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("cache");
  const [actionsPage, setActionsPage] = useState(1);
  const [actionsTotalPages, setActionsTotalPages] = useState(1);
  const [actionsItems, setActionsItems] = useState<any[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  // actionsSearchInput is the immediate text the user is typing; actionsSearch is the debounced committed query
  const [actionsSearchInput, setActionsSearchInput] = useState("");
  const [actionsSearch, setActionsSearch] = useState("");
  const [actionsSort, setActionsSort] = useState<
    "action" | "roles" | "privileged"
  >("action");
  const [actionsDir, setActionsDir] = useState<"asc" | "desc">("asc");
  const [actionsPrivFilter, setActionsPrivFilter] = useState<
    "all" | "priv" | "nonpriv"
  >("all");
  const pageSize = 25;

  // Roles tab state moved into RolesTab
  const [selectedRole, setSelectedRole] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [roleDetailsOpen, setRoleDetailsOpen] = useState(false);
  const [roleDetailsLoading, setRoleDetailsLoading] = useState(false);
  const [roleDetails, setRoleDetails] = useState<RoleDetails | null>(null);
  // Exclusions tab state moved into ExclusionsTab

  // Mappings tab state
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

  // Mappings list is now owned by MappingsTab

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
              // Fallback to opening without preselection
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
  }, []);
  // Exclusions list is now owned by ExclusionsTab

  const manualRefresh = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(new URL("/api/cache/refresh", apiBase), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      toast.success("Cache refresh triggered");
      window.dispatchEvent(new CustomEvent("cache-refreshed"));
    } catch {
      toast.error("Failed to trigger cache refresh");
    }
  };

  const loadActions = useCallback(
    async (page: number, search: string) => {
      if (!accessToken) {
        setActionsItems([]);
        setActionsTotalPages(1);
        return;
      }
      try {
        setActionsLoading(true);
        const term = search.trim();
        // Use wildcard to request a default list on empty search
        const q = term.length === 0 ? "*" : term;
        const url = new URL("/api/resourceaction/search", apiBase);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "100");
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error();
        const arr = (await res.json()) as Array<{
          id: string;
          action: string;
          isPrivileged: boolean;
        }>;
        let items = arr;
        if (actionsPrivFilter === "priv")
          items = items.filter((a) => a.isPrivileged);
        if (actionsPrivFilter === "nonpriv")
          items = items.filter((a) => !a.isPrivileged);
        // Sort client-side
        items.sort((a, b) => {
          if (actionsSort === "privileged") {
            const av = a.isPrivileged ? 1 : 0;
            const bv = b.isPrivileged ? 1 : 0;
            return actionsDir === "asc" ? av - bv : bv - av;
          }
          // action or roles (roles not available; fall back to action)
          return actionsDir === "asc"
            ? a.action.localeCompare(b.action)
            : b.action.localeCompare(a.action);
        });
        setActionsItems(items);
        setActionsTotalPages(1);
      } catch {
        setActionsItems([]);
        setActionsTotalPages(1);
      } finally {
        setActionsLoading(false);
      }
    },
    [accessToken, apiBase, actionsSort, actionsDir, actionsPrivFilter]
  );

  // Helper to parse the action into Namespace and Resource Type columns
  const parseActionParts = (
    action: string
  ): { namespace: string; resourceType: string } => {
    const parts = String(action || "").split("/");
    return {
      namespace: parts[0] || "",
      resourceType: parts[1] || "",
    };
  };

  useEffect(() => {
    if (activeTab === "actions") {
      loadActions(1, actionsSearch);
    }
  }, [activeTab, actionsSearch, loadActions]);

  // Roles list is now owned by RolesTab

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

  // Debounce the search input so we don't fetch for every keystroke and avoid focus loss due to rapid loading state flips
  useEffect(() => {
    const handle = setTimeout(() => {
      setActionsSearch((prev) =>
        prev !== actionsSearchInput ? actionsSearchInput : prev
      );
    }, 400); // 400ms debounce
    return () => clearTimeout(handle);
  }, [actionsSearchInput]);

  return (
    <>
      <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-medium tracking-wide">Configuration</h2>
        <div className="border-b flex gap-4 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`px-2 py-1 -mb-px border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(t.key)}
              aria-current={activeTab === t.key ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "cache" && (
          <CacheTab
            accessToken={accessToken}
            apiBase={apiBase}
            onRefresh={manualRefresh}
          />
        )}

        {activeTab === "mappings" && (
          <div className="grid gap-4 text-sm">
            <div>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
                <label className="text-xs font-medium">
                  Import activity/property mappings
                </label>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="block text-xs"
                  disabled={!accessToken}
                  aria-label="Import activity mappings JSON file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !accessToken) return;
                    setPendingImportFile(file);
                    setShowImportModal(true);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground space-y-1">
                  <span>
                    All existing mappings (including property mappings) will be
                    replaced.
                  </span>
                </p>
              </form>
            </div>
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
          </div>
        )}

        {activeTab === "exclusions" && (
          <ExclusionsTab accessToken={accessToken} apiBase={apiBase} />
        )}

        {activeTab === "actions" && (
          <ResourceActionsTab
            accessToken={accessToken}
            searchInput={actionsSearchInput}
            loading={actionsLoading}
            items={actionsItems}
            sort={actionsSort}
            dir={actionsDir}
            privFilter={actionsPrivFilter}
            onSearchInput={(v) => setActionsSearchInput(v)}
            onToggleDir={() =>
              setActionsDir((d) => (d === "asc" ? "desc" : "asc"))
            }
            onSort={(v) => setActionsSort(v)}
            onPrivFilter={(v) => setActionsPrivFilter(v)}
            parseActionParts={parseActionParts}
            onMapSelected={(ids) => {
              if (!ids || ids.length === 0) return;
              setMappingModalMode("create");
              setMappingModalName(null);
              setPreselectedActionIds(ids);
              setMappingModalOpen(true);
            }}
          />
        )}

        {activeTab === "roles" && (
          <RolesTab
            accessToken={accessToken}
            apiBase={apiBase}
            onOpenRole={(id, name) => {
              setSelectedRole({ id, name });
              setRoleDetailsOpen(true);
            }}
          />
        )}

        {activeTab === "future" && <FutureTab />}

        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !importBusy && setShowImportModal(false)}
            />
            <div className="relative bg-card text-card-foreground w-full max-w-md rounded-lg shadow-lg border p-5 space-y-4 animate-in fade-in zoom-in">
              <h3 className="text-sm font-semibold">Confirm import</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will{" "}
                <span className="font-semibold">
                  delete all existing activity mappings
                </span>{" "}
                and replace them with the contents of{" "}
                <code className="px-1 py-0.5 bg-muted rounded text-[11px]">
                  {pendingImportFile?.name}
                </code>
                . This action cannot be undone.
              </p>
              <div className="text-xs text-muted-foreground">
                {pendingImportFile && (
                  <div>
                    File size:{" "}
                    {(
                      Math.round(pendingImportFile.size / 102.4) / 10
                    ).toLocaleString()}{" "}
                    KB
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importBusy}
                  onClick={() => {
                    setShowImportModal(false);
                    setPendingImportFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-600/90"
                  disabled={importBusy || !pendingImportFile || !accessToken}
                  onClick={async () => {
                    if (!pendingImportFile || !accessToken) return;
                    setImportBusy(true);
                    try {
                      const text = await pendingImportFile.text();
                      const json = JSON.parse(text);
                      const res = await fetch(
                        new URL("/api/activity/import", apiBase),
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify(json),
                        }
                      );
                      if (!res.ok) {
                        toast.error("Import failed");
                        return;
                      }
                      const result = await res.json();
                      toast.success(`Import complete`, {
                        description: `Removed: ${result.removed}, Created: ${result.created}, Unknown actions: ${result.unknownActions.length}`,
                      });
                      window.dispatchEvent(
                        new CustomEvent("operation-mappings-updated")
                      );
                    } catch (err) {
                      toast.error("Invalid file or import error");
                    } finally {
                      setImportBusy(false);
                      setShowImportModal(false);
                      setPendingImportFile(null);
                    }
                  }}
                >
                  {importBusy ? "Importing…" : "Yes, replace mappings"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
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
    </>
  );
}
