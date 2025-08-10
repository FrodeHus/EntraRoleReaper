import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sun, Moon, Users, Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import {
  InteractionStatus,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { SearchUsers } from "./SearchUsers";
import { ReviewPanel } from "./ReviewPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

const apiScope = import.meta.env.VITE_API_SCOPE as string;
const apiBase = import.meta.env.VITE_API_URL as string;

export default function App() {
  const { instance, inProgress, accounts } = useMsal();
  const authed = useIsAuthenticated();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTokenExp = useRef<number | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [selected, setSelected] = useState<
    { id: string; displayName: string; type: "user" | "group" }[]
  >([]);
  const [openSearch, setOpenSearch] = useState(false);
  const reviewerName = accounts[0]?.name || accounts[0]?.username || "";
  const tenantDomain = (() => {
    const upn = accounts[0]?.username ?? "";
    const at = upn.indexOf("@");
    return at > -1 ? upn.slice(at + 1) : "";
  })();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const schedule = (expiresOn?: Date | null) => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      if (!expiresOn) return;
      const now = Date.now();
      const exp = expiresOn.getTime();
      lastTokenExp.current = exp;
      // Refresh 2 minutes before expiry, clamp to [30s, 50m]
      const twoMin = 2 * 60 * 1000;
      const minDelay = 30 * 1000;
      const maxDelay = 50 * 60 * 1000;
      let delay = Math.max(minDelay, exp - now - twoMin);
      delay = Math.min(delay, maxDelay);
      if (delay <= 0) delay = minDelay;
      refreshTimer.current = setTimeout(() => void fetchToken(), delay);
    };

    const fetchToken = async () => {
      if (!authed || accounts.length === 0) return;
      if (!navigator.onLine) {
        // If offline, retry after 30s
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => void fetchToken(), 30 * 1000);
        return;
      }
      try {
        const result = await instance.acquireTokenSilent({
          scopes: [apiScope],
          account: accounts[0],
        });
        setAccessToken(result.accessToken);
        schedule(result.expiresOn ?? null);
      } catch (err) {
        // Retry after short backoff; fall back to interactive if required
        if (err instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenRedirect({ scopes: [apiScope] });
          return;
        }
        // Non-interaction error: retry in 60s
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => void fetchToken(), 60 * 1000);
      }
    };

    // Kick off token fetch/refresh chain when authenticated
    if (authed && accounts.length > 0) {
      void fetchToken();
    } else {
      setAccessToken(null);
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      lastTokenExp.current = null;
    }

    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        authed &&
        accounts.length > 0
      ) {
        // If within 3 minutes of expiry, refresh now
        const now = Date.now();
        const threeMin = 3 * 60 * 1000;
        if (lastTokenExp.current && lastTokenExp.current - now < threeMin) {
          void fetchToken();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onOnline = () => {
      if (authed && accounts.length > 0) void fetchToken();
    };
    const onUserCancelled = () => {
      toast.info(
        "Sign-in was cancelled. Some features may stop working until you sign in again.",
        {
          duration: 6000,
        }
      );
    };
    window.addEventListener("online", onOnline);
    window.addEventListener(
      "msal:userCancelled" as any,
      onUserCancelled as any
    );

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(
        "msal:userCancelled" as any,
        onUserCancelled as any
      );
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [authed, accounts, instance]);

  const login = () => instance.loginRedirect({ scopes: [apiScope] });
  const logout = () => instance.logoutRedirect();
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top banner */}
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}rolereaper_logo.png`}
              alt="RoleReaper logo"
              className="h-6 w-6 rounded-sm border"
              loading="eager"
              decoding="async"
            />
            <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Entra Role Reaper
            </span>
          </div>
          <div className="flex items-center gap-2">
            {authed && (
              <div className="hidden sm:flex items-center gap-2 mr-2 text-xs">
                <span className="rounded border bg-card text-card-foreground px-2 py-1">
                  <span className="text-muted-foreground">Reviewer:</span>{" "}
                  <span className="font-medium">{reviewerName}</span>
                </span>
                <span className="rounded border bg-card text-card-foreground px-2 py-1">
                  <span className="text-muted-foreground">Tenant:</span>{" "}
                  <span className="font-medium">{tenantDomain || "-"}</span>
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {authed ? (
              <Button variant="outline" onClick={logout}>
                Sign out
              </Button>
            ) : (
              <Button onClick={login}>Sign in</Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
        {!authed ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-full max-w-xl border bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center">
              <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
              <p className="mb-6 text-muted-foreground">
                Sign in to start reviewing access for users and groups in your
                tenant.
              </p>
              <Button onClick={login}>Sign in</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Subjects card */}
            <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium tracking-wide">
                    Subjects
                  </h2>
                  {selected.length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                      {selected.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selected.length > 0 && (
                    <Button
                      variant="link"
                      className="text-sm"
                      onClick={() => setSelected([])}
                      aria-label="Clear selected users and groups"
                    >
                      Clear
                    </Button>
                  )}
                  <Button onClick={() => setOpenSearch(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add users or groups
                  </Button>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No subjects selected. Use “Add users or groups” to begin.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((s) => (
                      <span
                        key={`${s.type}:${s.id}`}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs bg-secondary text-secondary-foreground border"
                      >
                        <span className="font-medium">{s.displayName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setSelected((prev) =>
                              prev.filter(
                                (x) => !(x.id === s.id && x.type === s.type)
                              )
                            )
                          }
                          aria-label={`Remove ${s.displayName}`}
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <Sheet open={openSearch} onOpenChange={setOpenSearch}>
              <SheetContent side="right">
                <SheetHeader>
                  <div className="flex items-center justify-between">
                    <SheetTitle>Select user(s) or group(s)</SheetTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setOpenSearch(false)}
                      aria-label="Close"
                      title="Close"
                    >
                      Close
                    </Button>
                  </div>
                </SheetHeader>
                <div className="mt-3">
                  <SearchUsers
                    accessToken={accessToken}
                    selected={selected}
                    onChange={setSelected}
                  />
                </div>
              </SheetContent>
            </Sheet>
            {/* Review card */}
            <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5">
                <ReviewPanel
                  accessToken={accessToken}
                  selectedIds={selected.map((s) => `${s.type}:${s.id}`)}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
