import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheTab } from "./config/CacheTab";
import { ExclusionsTab } from "./config/ExclusionsTab";

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
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("cache");

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
