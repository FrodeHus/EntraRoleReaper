import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { useAccessToken } from "../hooks/useAccessToken";

type TenantInfo = {
  tenantId: string;
  name?: string;
  domain?: string;
};

export function TenantPage() {
  const { accessToken } = useAccessToken();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!accessToken) {
        throw new Error("Please sign in to view tenant information.");
      }
      const res = await fetch(
        new URL("/api/onboarding/", import.meta.env.VITE_API_URL),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!res.ok) {
        let detail = "";
        try {
          const prob = await res.json();
          detail = prob?.detail || prob?.title || "";
        } catch {}
        throw new Error(detail || `Failed to load tenant (HTTP ${res.status}).`);
      }
      const json = (await res.json()) as TenantInfo;
      setTenant(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenant.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tenant</h1>
        <Button onClick={load} disabled={loading} aria-busy={loading} variant="outline">
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 p-3 text-sm">
          {error}
        </div>
      )}
      <div className="border rounded-lg bg-card text-card-foreground shadow-sm p-4">
        {tenant ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Tenant ID</div>
              <div className="font-mono break-all">{tenant.tenantId}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Name</div>
              <div>{tenant.name || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Primary domain</div>
              <div>{tenant.domain || "-"}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading tenant information…" : "No tenant information available."}
          </div>
        )}
      </div>
    </div>
  );
}
