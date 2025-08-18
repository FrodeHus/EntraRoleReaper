import { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheStatusChip } from "../CacheStatusChip";
import { RoleDetailsSheet } from "../review/RoleDetailsSheet";
import type { RoleDetails } from "../review/types";
import ActivityMappingModal from "../review/ActivityMappingModal";
import { OperationMappingSheet } from "../review/OperationMappingSheet";
import { Plus, Trash2 } from "lucide-react";

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
  { key: "actions", label: "Actions" },
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
        const res = await fetch(
          new URL(
            `/api/operations/map/${encodeURIComponent(
              activityName
            )}/properties/${encodeURIComponent(propertyName)}`,
            apiBase
          ),
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
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
      const res = await fetch(new URL("/api/operations/map/export", apiBase), {
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
      const res = await fetch(new URL("/api/operations/exclusions", apiBase), {
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
        new URL(
          `/api/operations/exclusions/${encodeURIComponent(name)}`,
          apiBase
        ),
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
        if (!term) {
          setActionsItems([]);
          setActionsTotalPages(1);
          return;
        }
        const url = new URL("/api/actions/search", apiBase);
        url.searchParams.set("q", term);
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
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <CacheStatusChip accessToken={accessToken} apiBase={apiBase} />
              <Button
                size="sm"
                variant="secondary"
                disabled={!accessToken}
                onClick={manualRefresh}
              >
                Refresh cache now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              The role cache is periodically refreshed; trigger a manual refresh
              if you recently adjusted directory role definitions.
            </p>
          </div>
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
                      new URL("/api/operations/map/export", apiBase),
                      { headers: { Authorization: `Bearer ${accessToken}` } }
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Current mappings</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={mappingsLoading || !accessToken}
                  onClick={() => loadMappings()}
                >
                  {mappingsLoading ? "Refreshing" : "Refresh"}
                </Button>
              </div>
              <div className="border rounded h-[55vh] overflow-auto text-xs divide-y bg-card text-card-foreground">
                {mappingsLoading && (
                  <div className="p-2 text-muted-foreground">Loading…</div>
                )}
                {!mappingsLoading && mappings.length === 0 && (
                  <div className="p-2 text-muted-foreground">No mappings.</div>
                )}
                {!mappingsLoading && mappings.length > 0 && (
                  <ul>
                    {mappings.map((m) => {
                      const propKeys = Object.keys(m.properties || {});
                      const propCount = propKeys.length;
                      return (
                        <li key={m.name} className="p-2">
                          <button
                            className="w-full text-left flex items-center gap-2 hover:underline"
                            onClick={() => {
                              setMappingModalMode("edit");
                              setMappingModalName(m.name);
                              setMappingModalOpen(true);
                            }}
                            title="Edit base mapping"
                          >
                            <span className="font-mono break-all flex-1">
                              {m.name}
                            </span>
                            <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">
                              actions: {m.actions.length}
                            </span>
                            <span className="text-[10px] px-1 rounded border bg-muted text-muted-foreground">
                              properties: {propCount}
                            </span>
                          </button>
                          {propCount > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {propKeys.slice(0, 20).map((p) => (
                                <div
                                  key={`${m.name}::${p}`}
                                  className="inline-flex items-center gap-1"
                                >
                                  <button
                                    className="px-1.5 py-0.5 border rounded bg-muted hover:bg-muted/70"
                                    title={`Edit property mapping: ${m.name}::${p}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpSheetOperationName(
                                        `${m.name}::${p}`
                                      );
                                      setOpSheetOpen(true);
                                    }}
                                  >
                                    <span className="font-mono">{p}</span>
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                      {m.properties?.[p]?.length ?? 0}
                                    </span>
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    title={`Delete ${m.name}::${p}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deletePropertyMap(m.name, p);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              {propKeys.length > 20 && (
                                <span className="text-[10px] text-muted-foreground">
                                  …
                                </span>
                              )}
                              <button
                                className="ml-2 px-1.5 py-0.5 border rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prop = prompt("New property name");
                                  const val = (prop || "").trim();
                                  if (!val) return;
                                  // if property exists, just open
                                  if (
                                    Object.keys(m.properties || {}).some(
                                      (k) =>
                                        k.toLowerCase() === val.toLowerCase()
                                    )
                                  ) {
                                    setOpSheetOperationName(
                                      `${m.name}::${val}`
                                    );
                                    setOpSheetOpen(true);
                                    return;
                                  }
                                  setOpSheetOperationName(`${m.name}::${val}`);
                                  setOpSheetOpen(true);
                                }}
                                title="Add property"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add property</span>
                              </button>
                            </div>
                          )}
                          {propCount === 0 && (
                            <div className="mt-2">
                              <button
                                className="px-1.5 py-0.5 border rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prop = prompt("New property name");
                                  const val = (prop || "").trim();
                                  if (!val) return;
                                  setOpSheetOperationName(`${m.name}::${val}`);
                                  setOpSheetOpen(true);
                                }}
                                title="Add property"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add property</span>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "exclusions" && (
          <div className="space-y-3 text-sm max-w-md">
            <p className="text-xs text-muted-foreground">
              Activities in this list are excluded from review output.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={!accessToken}
                onClick={async () => {
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
              >
                Export
              </Button>
              <div>
                <label className="text-[10px] block font-medium mb-0.5">
                  Import
                </label>
                <input
                  type="file"
                  className="text-[10px]"
                  accept="application/json,.json"
                  disabled={!accessToken}
                  aria-label="Import exclusion list JSON file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !accessToken) return;
                    try {
                      const text = await file.text();
                      const arr = JSON.parse(text);
                      if (!Array.isArray(arr)) throw new Error();
                      // Replace current exclusions with imported list client-side
                      const current = new Set(
                        exclusions.map((e) => e.name.toLowerCase())
                      );
                      const desired = new Set(
                        (arr as string[]).map((s) => s.toLowerCase())
                      );
                      let created = 0;
                      let removed = 0;
                      // Remove not desired
                      for (const name of current) {
                        if (!desired.has(name)) {
                          await fetch(
                            new URL(
                              `/api/operations/exclusions/${encodeURIComponent(
                                name
                              )}`,
                              apiBase
                            ),
                            {
                              method: "DELETE",
                              headers: {
                                Authorization: `Bearer ${accessToken}`,
                              },
                            }
                          );
                          removed++;
                        }
                      }
                      // Add new ones
                      for (const name of desired) {
                        if (!current.has(name)) {
                          await fetch(
                            new URL("/api/operations/exclusions", apiBase),
                            {
                              method: "POST",
                              headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ operationName: name }),
                            }
                          );
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
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="border rounded bg-card text-card-foreground divide-y">
              {exclusionsLoading && (
                <div className="p-2 text-xs text-muted-foreground">
                  Loading…
                </div>
              )}
              {!exclusionsLoading && exclusions.length === 0 && (
                <div className="p-2 text-xs text-muted-foreground">
                  No exclusions.
                </div>
              )}
              {!exclusionsLoading && exclusions.length > 0 && (
                <ul>
                  {exclusions.map((e) => (
                    <li
                      key={e.name}
                      className="flex items-center gap-2 p-2 text-xs"
                    >
                      <span className="font-mono break-all flex-1">
                        {e.name}
                      </span>
                      <button
                        onClick={() => removeExclusion(e.name)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove exclusion"
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search actions"
                  value={actionsSearchInput}
                  onChange={(e) => setActionsSearchInput(e.target.value)}
                  className="border rounded px-2 py-1 pr-6 text-xs w-full bg-background"
                  // Keep input enabled during loading so focus isn't lost; only disable when no token
                  disabled={!accessToken}
                  aria-label="Search actions or roles"
                />
                {actionsLoading && (
                  <span
                    className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                    aria-hidden="true"
                  >
                    <span className="h-3 w-3 inline-block animate-spin rounded-full border border-muted-foreground/40 border-t-muted-foreground" />
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center text-[10px]">
                <select
                  className="border rounded px-1 py-1 bg-background"
                  value={actionsSort}
                  onChange={(e) => setActionsSort(e.target.value as any)}
                  disabled={actionsLoading}
                  aria-label="Sort by"
                >
                  <option value="action">Action</option>
                  <option value="roles">Role count</option>
                  <option value="privileged">Privileged</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setActionsDir((d) => (d === "asc" ? "desc" : "asc"))
                  }
                  disabled={actionsLoading}
                  title="Toggle sort direction"
                >
                  {actionsDir === "asc" ? "Asc" : "Desc"}
                </Button>
                <select
                  className="border rounded px-1 py-1 bg-background"
                  value={actionsPrivFilter}
                  onChange={(e) => setActionsPrivFilter(e.target.value as any)}
                  disabled={actionsLoading}
                  aria-label="Privilege filter"
                >
                  <option value="all">All</option>
                  <option value="priv">Privileged</option>
                  <option value="nonpriv">Non-privileged</option>
                </select>
              </div>
            </div>
            <div className="border rounded h-[55vh] overflow-auto text-xs divide-y">
              {actionsLoading && (
                <div className="p-2 text-muted-foreground">
                  Loading actions…
                </div>
              )}
              {!actionsLoading && actionsItems.length === 0 && (
                <div className="p-2 text-muted-foreground">
                  No actions found.
                </div>
              )}
              {!actionsLoading && actionsItems.length > 0 && (
                <ul>
                  {actionsItems.map((a) => (
                    <li key={a.id} className="p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono break-all">{a.action}</span>
                        {a.isPrivileged && (
                          <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            priv
                          </span>
                        )}
                        {/* roles count not available in search endpoint */}
                      </div>
                      {/* roles list not provided by search endpoint */}
                    </li>
                  ))}
                </ul>
              )}
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
        )}

        {activeTab === "roles" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-between">
              <h3 className="text-sm font-medium">Role definitions</h3>
              <Button
                size="sm"
                variant={rolesPrivOnly ? "default" : "outline"}
                onClick={() => setRolesPrivOnly((v) => !v)}
                disabled={!accessToken || rolesLoading}
              >
                {rolesPrivOnly ? "Showing privileged" : "Privileged only"}
              </Button>
            </div>
            <div className="border rounded h-[55vh] overflow-auto text-xs divide-y">
              {rolesLoading && (
                <div className="p-2 text-muted-foreground">Loading roles…</div>
              )}
              {!rolesLoading && rolesItems.length === 0 && (
                <div className="p-2 text-muted-foreground">No roles found.</div>
              )}
              {!rolesLoading && rolesItems.length > 0 && (
                <ul>
                  {rolesItems.map((r: any) => (
                    <li key={r.id || r.Id} className="p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <button
                          className="font-semibold text-left hover:underline"
                          onClick={() => {
                            const id = r.id || r.Id;
                            const name = r.displayName || r.DisplayName;
                            setSelectedRole({ id, name });
                            setRoleDetailsOpen(true);
                          }}
                        >
                          {r.displayName || r.DisplayName}
                        </button>
                        {/* Show privileged badge when role has any privileged actions */}
                        {((r.permissionSets || r.PermissionSets) ?? []).some(
                          (ps: any) =>
                            (
                              (ps.resourceActions || ps.ResourceActions) ??
                              []
                            ).some(
                              (ra: any) =>
                                ra.isPrivileged === true ||
                                ra.IsPrivileged === true
                            )
                        ) && (
                          <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            Privileged
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {r.isBuiltIn === true ? "Built-in" : "Custom"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "future" && (
          <div className="text-xs text-muted-foreground">
            Additional configuration options will appear here in future
            versions.
          </div>
        )}

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
                        new URL("/api/operations/map/import", apiBase),
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
