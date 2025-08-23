import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useAccessToken } from "../hooks/useAccessToken";
import { JobQueue } from "../JobQueue";

type TenantInfo = {
  id?: string | null;
  name?: string | null;
  domain?: string | null;
  customRoleCount?: number | null;
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
        throw new Error(
          detail || `Failed to load tenant (HTTP ${res.status}).`
        );
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
        <Button
          onClick={load}
          disabled={loading}
          aria-busy={loading}
          variant="outline"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium tracking-wide">
            Tenant information
          </CardTitle>
          {tenant?.customRoleCount != null && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground"
              title="Custom role count"
            >
              <span className="font-medium text-foreground/80">
                Custom roles:
              </span>
              <span className="tabular-nums">{tenant.customRoleCount}</span>
            </span>
          )}
        </CardHeader>
        <CardContent>
          {!tenant ? (
            <div className="text-sm text-muted-foreground">
              {loading
                ? "Loading tenant information…"
                : "No tenant information available."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Tenant ID</div>
                <div className="font-mono break-all">{tenant.id || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Name</div>
                <div>{tenant.name || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Primary domain</div>
                <div>{tenant.domain || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Custom roles</div>
                <div className="tabular-nums">
                  {tenant.customRoleCount ?? 0}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <JobQueue
        accessToken={accessToken}
        defaultCollapsed={true}
        title="Background jobs"
      />
      {error && (
        <div className="rounded-md border border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 p-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
