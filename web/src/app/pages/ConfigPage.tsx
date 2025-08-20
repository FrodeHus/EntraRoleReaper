import { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheStatusChip } from "../CacheStatusChip";
import { RoleDetailsSheet } from "../review/RoleDetailsSheet";
import type { RoleDetails } from "../review/types";
import ActivityMappingModal from "../review/ActivityMappingModal";
import { OperationMappingSheet } from "../review/OperationMappingSheet";
import { Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
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

  // Roles tab state
  const [rolesItems, setRolesItems] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesPrivOnly, setRolesPrivOnly] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [roleDetailsOpen, setRoleDetailsOpen] = useState(false);
  const [roleDetailsLoading, setRoleDetailsLoading] = useState(false);
  const [roleDetails, setRoleDetails] = useState<RoleDetails | null>(null);
  // Exclusions tab state (backend returns Activity objects with Name/IsExcluded)
  const [exclusions, setExclusions] = useState<Array<{ name: string }>>([]);
  const [exclusionsLoading, setExclusionsLoading] = useState(false);

  // Mappings tab state
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappings, setMappings] = useState<
    Array<{
      name: string;
      actions: string[];
      properties: Record<string, string[]>;
    }>
  >([]);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingModalMode, setMappingModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [mappingModalName, setMappingModalName] = useState<string | null>(null);
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

  const loadMappings = useCallback(async () => {
    if (!accessToken || activeTab !== "mappings") return;
    try {
      setMappingsLoading(true);
      const res = await fetch(new URL("/api/activity/export", apiBase), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      // json is expected to be an array of ActivityExport
      const arr: any[] = Array.isArray(json)
        ? json
        : typeof json === "object" && json
        ? Object.values(json as any)
        : [];
      const list = arr.map((it) => {
        const name = String(it.name ?? it.Name ?? "");
        const actions: string[] = Array.isArray(it.mappedResourceActions)
          ? it.mappedResourceActions
          : Array.isArray(it.MappedResourceActions)
          ? it.MappedResourceActions
          : [];
        const props: Record<string, string[]> = (it.properties ??
          it.Properties ??
          {}) as any;
        return { name, actions, properties: props };
      });
      // sort alphabetically
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMappings(list);
    } catch {
      setMappings([]);
    } finally {
      setMappingsLoading(false);
    }
  }, [accessToken, apiBase, activeTab]);

  useEffect(() => {
    if (activeTab === "mappings") {
      loadMappings();
    }
  }, [activeTab, loadMappings]);

  useEffect(() => {
    const handler = () => {
      // refresh mappings when updated elsewhere
      loadMappings();
    };
    window.addEventListener("operation-mappings-updated", handler as any);
    return () =>
      window.removeEventListener("operation-mappings-updated", handler as any);
  }, [loadMappings]);

  useEffect(() => {
    const openHandler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { operationName?: string };
        if (detail?.operationName) {
          setOpSheetOperationName(detail.operationName);
          setOpSheetOpen(true);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("open-op-mapping", openHandler as any);
    return () =>
      window.removeEventListener("open-op-mapping", openHandler as any);
  }, []);

  const loadExclusions = useCallback(async () => {
    if (!accessToken || activeTab !== "exclusions") return;
    try {
      setExclusionsLoading(true);
      const res = await fetch(new URL("/api/activity/exclude", apiBase), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const arr: any[] = Array.isArray(json) ? json : [];
      const list = arr.map((a) => ({
        name: String(a.name ?? a.Name ?? ""),
      })) as Array<{
        name: string;
      }>;
      setExclusions(list.filter((e) => e.name));
    } catch {
      setExclusions([]);
    } finally {
      setExclusionsLoading(false);
    }
  }, [accessToken, apiBase, activeTab]);

  useEffect(() => {
    loadExclusions();
  }, [loadExclusions]);

  const removeExclusion = async (name: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(
        new URL(`/api/activity/exclude/${encodeURIComponent(name)}`, apiBase),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        toast.success("Exclusion removed", { description: name });
        loadExclusions();
      }
    } catch {
      /* ignore */
    }
  };

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

  // Load roles when roles tab active or filter toggled
  useEffect(() => {
    const loadRoles = async () => {
      if (activeTab !== "roles") return;
      if (!accessToken) {
        setRolesItems([]);
        return;
      }
      try {
        setRolesLoading(true);
        const url = new URL("/api/roles/summary", apiBase);
        // fetch a generous page size to get all (cached) role definitions
        url.searchParams.set("page", "1");
        url.searchParams.set("pageSize", "500");
        if (rolesPrivOnly) url.searchParams.set("privilegedOnly", "true");
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        // API returns { total, roles }
        const list = (json?.roles ?? json?.items ?? []) as any[];
        // Helper to determine if a role has any privileged actions
        const isRolePrivileged = (r: any) =>
          ((r.permissionSets || r.PermissionSets) ?? []).some((ps: any) =>
            ((ps.resourceActions || ps.ResourceActions) ?? []).some(
              (ra: any) => ra.isPrivileged === true || ra.IsPrivileged === true
            )
          );
        // Apply client-side privileged filter as backend may ignore it without a search term
        const filtered = rolesPrivOnly ? list.filter(isRolePrivileged) : list;
        // Sort alphabetically by display name
        filtered.sort((a: any, b: any) =>
          String(a.displayName || a.DisplayName || "")
            .toLowerCase()
            .localeCompare(
              String(b.displayName || b.DisplayName || "").toLowerCase()
            )
        );
        setRolesItems(filtered);
      } catch {
        setRolesItems([]);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, [activeTab, rolesPrivOnly, accessToken, apiBase]);

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
              <Button
                variant="outline"
                size="sm"
                disabled={!accessToken}
                onClick={async () => {
                  if (!accessToken) return;
                  try {
                    const res = await fetch(
                      new URL("/api/activity/export", apiBase),
                      {
                        headers: { Authorization: `Bearer ${accessToken}` },
                      }
                    );
                    if (!res.ok) return;
                    const json = await res.json();
                    const blob = new Blob([JSON.stringify(json, null, 2)], {
                      type: "application/json",
                    });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    const ts = new Date();
                    const pad = (n: number) => n.toString().padStart(2, "0");
                    a.download = `activity-mappings-${ts.getFullYear()}${pad(
                      ts.getMonth() + 1
                    )}${pad(ts.getDate())}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    const opCount =
                      typeof json === "object" && json
                        ? Object.keys(json).length
                        : 0;
                    toast.success("Exported activity mappings", {
                      description: `${opCount} activities`,
                    });
                  } catch {
                    toast.error("Export failed");
                  }
                }}
              >
                Export activity mappings
              </Button>
              <Button
                className="ml-2"
                size="sm"
                disabled={!accessToken}
                onClick={() => {
                  setMappingModalMode("create");
                  setMappingModalName(null);
                  setMappingModalOpen(true);
                }}
              >
                Create mapping
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Download current activity and property-level mappings. Legacy
                activities without property mappings export as an array; those
                with properties export an object containing actions and a
                properties map.
              </p>
            </div>
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
                  <span>Upload JSON. Accepted formats:</span>
                  <br />
                  <code className="bg-muted px-1 py-0.5 rounded text-[10px] inline-block">{`{"Activity": ["action"]}`}</code>
                  <span className="mx-1">or</span>
                  <code className="bg-muted px-1 py-0.5 rounded text-[10px] inline-block">{`{"Activity": {"actions": ["action"], "properties": {"Prop": ["action"]}}}`}</code>
                  <br />
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
              items={mappings}
              loading={mappingsLoading}
              onRefresh={() => loadMappings()}
              onExport={async () => {}}
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
          <ExclusionsTab
            accessToken={accessToken}
            items={exclusions}
            loading={exclusionsLoading}
            onExport={async () => {
              try {
                const names = exclusions.map((e) => e.name);
                const blob = new Blob([JSON.stringify(names, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "activity-exclusions.json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast.success("Exported exclusions", {
                  description: `${names.length} activities`,
                });
              } catch {
                toast.error("Export failed");
              }
            }}
            onImport={async (file) => {
              if (!accessToken) return;
              try {
                const text = await file.text();
                const arr = JSON.parse(text);
                if (!Array.isArray(arr)) throw new Error();
                const current = new Set(
                  exclusions.map((e) => e.name.toLowerCase())
                );
                const desired = new Set(
                  (arr as string[]).map((s) => s.toLowerCase())
                );
                let created = 0;
                let removed = 0;
                for (const name of current) {
                  if (!desired.has(name)) {
                    await fetch(
                      new URL(
                        `/api/activity/exclude/${encodeURIComponent(name)}`,
                        apiBase
                      ),
                      {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${accessToken}` },
                      }
                    );
                    removed++;
                  }
                }
                for (const name of desired) {
                  if (!current.has(name)) {
                    await fetch(new URL("/api/activity/exclude", apiBase), {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ activityName: name }),
                    });
                    created++;
                  }
                }
                toast.success("Import complete", {
                  description: `${created} created, ${removed} removed`,
                });
                loadExclusions();
              } catch {
                toast.error("Import failed");
              }
            }}
            onRemove={(name) => removeExclusion(name)}
          />
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
          />
        )}

        {activeTab === "roles" && (
          <RolesTab
            accessToken={accessToken}
            items={rolesItems}
            loading={rolesLoading}
            privOnly={rolesPrivOnly}
            onTogglePrivOnly={() => setRolesPrivOnly((v) => !v)}
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
        onOpenChange={(o) => setMappingModalOpen(o)}
        accessToken={accessToken}
        apiBase={apiBase}
        initialActivityName={mappingModalName}
        mode={mappingModalMode}
        onSaved={() => loadMappings()}
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
