import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Users,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import {
  InteractionStatus,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { SearchUsers, type DirectoryItem } from "./SearchUsers";
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
  const [selected, setSelected] = useState<DirectoryItem[]>([]);
  const [openSearch, setOpenSearch] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
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
    // Schedules a silent token refresh a bit before expiry
    const schedule = (expiresOn?: Date | null) => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      if (!expiresOn) return;
      const skewMs = 60 * 1000; // 60s skew
      const dueIn = Math.max(5_000, expiresOn.getTime() - Date.now() - skewMs);
      refreshTimer.current = setTimeout(() => {
        void fetchToken();
      }, dueIn);
    };

    // Fetch access token silently and set refresh
    const fetchToken = async () => {
      try {
        if (!authed || accounts.length === 0) return;
        // Avoid fetching while an interactive flow is in progress
        if (inProgress && inProgress !== InteractionStatus.None) return;
        const result = await instance.acquireTokenSilent({
          account: accounts[0],
          scopes: [apiScope],
        });
        setAccessToken(result.accessToken);
        lastTokenExp.current = result.expiresOn?.getTime() ?? null;
        schedule(result.expiresOn ?? null);
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          // Ignore here; main.tsx will surface user-cancel events if needed
          return;
        }
        // For other errors, surface a toast once
        toast.error("Failed to refresh session token.");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchToken();
      }
    };

    const onOnline = () => {
      void fetchToken();
    };

    const onUserCancelled = () => {
      toast.info(
        "Sign-in was cancelled. Some features may stop working until you sign in again.",
        { duration: 6000 }
      );
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener(
      "msal:userCancelled" as any,
      onUserCancelled as any
    );

    // Initial fetch
    void fetchToken();

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
  }, [authed, accounts, instance, inProgress]);

  const login = () => instance.loginRedirect({ scopes: [apiScope] });
  const logout = () => instance.logoutRedirect();
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top banner (only when authenticated) */}
      {authed && (
        <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}entrarolereaper_logo.png`}
                alt="RoleReaper logo"
                loading="eager"
                className="h-24 w-24 mt-8"
                decoding="async"
              />
              <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Entra RoleReaper
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2 text-xs">
                <span className="rounded border bg-card text-card-foreground px- py-1">
                  <span className="text-muted-foreground">Reviewer:</span>{" "}
                  <span className="font-medium">{reviewerName}</span>
                </span>
                <span className="rounded border bg-card text-card-foreground px-2 py-1">
                  <span className="text-muted-foreground">Tenant:</span>{" "}
                  <span className="font-medium">{tenantDomain || "-"}</span>
                </span>
              </div>
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
              <Button variant="outline" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
        {!authed ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-full max-w-xl border bg-card text-card-foreground rounded-lg shadow-sm p-8 text-center">
              <div className="flex justify-center mb-4">
                <img
                  src={`${import.meta.env.BASE_URL}entrarolereaper_logo.png`}
                  alt="RoleReaper logo"
                  className="h-20 w-20"
                  loading="eager"
                  decoding="async"
                />
                <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Entra RoleReaper
                </span>
              </div>
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
            {/* Subjects card (collapsible) */}
            <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
                <button
                  type="button"
                  className="flex items-center gap-2 hover:opacity-90"
                  onClick={() => setSubjectsOpen((o) => !o)}
                >
                  {subjectsOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium tracking-wide">
                    Subjects
                  </h2>
                  {selected.length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                      {selected.length}
                    </span>
                  )}
                </button>
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
              {subjectsOpen && (
                <div className="p-4 sm:p-5">
                  {selected.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No subjects selected. Use “Add users or groups” to begin.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="p-2">Display name</th>
                            <th className="p-2">Type</th>
                            <th className="p-2 sr-only">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.map((s) => (
                            <tr key={`${s.type}:${s.id}`} className="border-t">
                              <td className="p-2">{s.displayName}</td>
                              <td className="p-2 capitalize">{s.type}</td>
                              <td className="p-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setSelected((prev) =>
                                      prev.filter(
                                        (x) =>
                                          !(x.id === s.id && x.type === s.type)
                                      )
                                    )
                                  }
                                  aria-label={`Remove ${s.displayName}`}
                                  title="Remove"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
                  selectedIds={selected
                    .filter((s) => s.type === "user" || s.type === "group")
                    .map((s) => `${s.type}:${s.id}`)}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
