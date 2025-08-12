import { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheStatusChip } from "../CacheStatusChip";
import { RoleDetailsSheet } from "../review/RoleDetailsSheet";
import type { RoleDetails } from "../review/types";

// Simple tab primitives (could be replaced with a UI lib tabs in future)
interface TabConfig {
  key: string;
  label: string;
}
const tabs: TabConfig[] = [
  { key: "cache", label: "Cache" },
  { key: "mappings", label: "Mappings" },
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
    async (
      page: number,
      search: string,
      sort = actionsSort,
      dir = actionsDir,
      priv = actionsPrivFilter
    ) => {
      if (!accessToken) {
        setActionsItems([]);
        return;
      }
      try {
        setActionsLoading(true);
        const url = new URL("/api/actions/usage", apiBase);
        url.searchParams.set("page", page.toString());
        url.searchParams.set("pageSize", pageSize.toString());
        url.searchParams.set("sort", sort);
        url.searchParams.set("dir", dir);
        if (priv === "priv") url.searchParams.set("privileged", "yes");
        else if (priv === "nonpriv") url.searchParams.set("privileged", "no");
        if (search.trim()) url.searchParams.set("search", search.trim());
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setActionsItems(json.items || []);
        setActionsTotalPages(json.totalPages || 1);
      } catch {
        setActionsItems([]);
      } finally {
        setActionsLoading(false);
      }
    },
    [accessToken, apiBase, actionsSort, actionsDir, actionsPrivFilter]
  );

  useEffect(() => {
    if (activeTab === "actions") {
      loadActions(1, actionsSearch, actionsSort, actionsDir, actionsPrivFilter);
    }
  }, [activeTab, actionsSearch, actionsSort, actionsDir, actionsPrivFilter, loadActions]);

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
        setRolesItems(json.items || []);
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
          <div className="grid gap-4 text-sm max-w-md">
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
                    a.download = `operation-mappings-${ts.getFullYear()}${pad(
                      ts.getMonth() + 1
                    )}${pad(ts.getDate())}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    const opCount =
                      typeof json === "object" && json
                        ? Object.keys(json).length
                        : 0;
                    toast.success("Exported operation mappings", {
                      description: `${opCount} operations`,
                    });
                  } catch {
                    toast.error("Export failed");
                  }
                }}
              >
                Export operation mappings
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Download current operation and property-level mappings. Legacy operations without property mappings export as an array; those with properties export an object containing actions and a properties map.
              </p>
            </div>
            <div>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
                <label className="text-xs font-medium">Import operation/property mappings</label>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="block text-xs"
                  disabled={!accessToken}
                  aria-label="Import operation mappings JSON file"
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
                  <code className="bg-muted px-1 py-0.5 rounded text-[10px] inline-block">{`{"Operation": ["action"]}`}</code>
                  <span className="mx-1">or</span>
                  <code className="bg-muted px-1 py-0.5 rounded text-[10px] inline-block">{`{"Operation": {"actions": ["action"], "properties": {"Prop": ["action"]}}}`}</code>
                  <br />
                  <span>All existing mappings (including property mappings) will be replaced.</span>
                </p>
              </form>
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search actions or roles"
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
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {a.roleCount ?? (a.roles?.length || 0)} roles
                        </span>
                      </div>
                      {a.roles && a.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.roles.map((r: any) => (
                            <span
                              key={r.id}
                              className="text-[10px] px-1 py-0.5 rounded bg-muted/50 border border-muted-foreground/20"
                            >
                              {r.displayName || r.DisplayName}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end text-[10px]">
              <span>
                Page {actionsPage} / {actionsTotalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionsPage <= 1 || actionsLoading}
                  onClick={() => loadActions(actionsPage - 1, actionsSearch)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionsPage >= actionsTotalPages || actionsLoading}
                  onClick={() => loadActions(actionsPage + 1, actionsSearch)}
                >
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
                        {r.privileged === true || r.Privileged === true ? (
                          <span className="text-[10px] px-1 rounded border bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            priv
                          </span>
                        ) : null}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {r.isBuiltIn === true || r.IsBuiltIn === true
                            ? "Built-in"
                            : "Custom"}
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
                  delete all existing operation mappings
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
    </>
  );
}
