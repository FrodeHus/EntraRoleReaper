import { useEffect, useRef, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";
import { toast } from "sonner";
// (Scope and base resolved directly from environment to reduce indirection.)

// Retrieves and refreshes an API access token. Scope and base URL obtained via hooks.
export function useAccessToken() {
  const apiScope = (import.meta.env.VITE_API_SCOPE as string) || "";
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const { instance, inProgress, accounts } = useMsal();
  const authed = useIsAuthenticated();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCacheInitAttempt = useRef<number>(0);

  useEffect(() => {
    const ensureCacheFresh = async (token: string) => {
      const now = Date.now();
      if (now - lastCacheInitAttempt.current < 120_000) return;
      lastCacheInitAttempt.current = now;
      try {
        const statusUrl = new URL("/api/cache/status", apiBase);
        const res = await fetch(statusUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const json = await res.json();
        const roleCount = typeof json.roleCount === "number" ? json.roleCount : 0;
        const lastUpdatedUtc = json.lastUpdatedUtc ? Date.parse(json.lastUpdatedUtc) : null;
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const stale = !lastUpdatedUtc || Date.now() - lastUpdatedUtc > weekMs;
        if (roleCount === 0 || stale) {
          const refreshUrl = new URL("/api/cache/refresh", apiBase);
            await fetch(refreshUrl, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        }
      } catch { /* ignore */ }
    };

    const schedule = (expiresOn?: Date | null) => {
      if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
      if (!expiresOn) return;
      const skewMs = 60_000;
      const dueIn = Math.max(5_000, expiresOn.getTime() - Date.now() - skewMs);
      refreshTimer.current = setTimeout(() => { void fetchToken(); }, dueIn);
    };

    const fetchToken = async () => {
      try {
        if (!authed || accounts.length === 0) return;
        if (inProgress && inProgress !== InteractionStatus.None) return;
        const result = await instance.acquireTokenSilent({ account: accounts[0], scopes: [apiScope] });
        setAccessToken(result.accessToken);
        schedule(result.expiresOn ?? null);
        void ensureCacheFresh(result.accessToken);
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) return;
        toast.error("Failed to refresh session token.");
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") void fetchToken(); };
    const onOnline = () => { void fetchToken(); };
    const onUserCancelled = () => { toast.info("Sign-in was cancelled. Some features may stop working until you sign in again.", { duration: 6000 }); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("msal:userCancelled" as any, onUserCancelled as any);
    void fetchToken();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("msal:userCancelled" as any, onUserCancelled as any);
      if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
    };
  }, [authed, accounts, instance, inProgress, apiScope, apiBase]);

  return { accessToken };
}
