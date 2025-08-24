import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheTab } from "./config/CacheTab";
import { ExclusionsTab } from "./config/ExclusionsTab";
import { ResourceActionsTab } from "./config/ResourceActionsTab";
import { FutureTab } from "./config/FutureTab";

// Simple tab primitives (could be replaced with a UI lib tabs in future)
interface TabConfig {
  key: string;
  label: string;
}
const tabs: TabConfig[] = [
  { key: "cache", label: "Cache" },
  { key: "exclusions", label: "Exclusions" },
];

interface ConfigPageProps {
  accessToken: string | null;
  apiBase: string;
}

export function ConfigPage({ accessToken, apiBase }: ConfigPageProps) {
  const navigate = useNavigate();
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

  // Exclusions tab state moved into ExclusionsTab

  // Mappings moved to dedicated page

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

  // Mappings list moved to MappingsPage

  // open-op-mapping listeners moved to Roles/Mappings pages
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

  // Roles moved to dedicated page

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

        {/* Mappings tab removed; see MappingsPage */}

        {activeTab === "exclusions" && (
          <ExclusionsTab accessToken={accessToken} apiBase={apiBase} />
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
      {/* RoleDetailsSheet removed; lives on RolesPage; mapping modals live on Mappings/Roles pages */}
    </>
  );
}
