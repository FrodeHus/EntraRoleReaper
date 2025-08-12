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
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import {
  InteractionStatus,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { SearchUsers, type DirectoryItem } from "./SearchUsers";
import { ReviewPanel } from "./ReviewPanel";
import { RolesBrowser } from "./RolesBrowser";
import { CacheStatusChip } from "./CacheStatusChip";
import { Menu, X as CloseIcon } from "lucide-react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Shield, Settings, List } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

const apiScope = import.meta.env.VITE_API_SCOPE as string;
const apiBase = import.meta.env.VITE_API_URL as string;

function CacheStatus({ accessToken }: { accessToken: string | null }) {
  const [roleCount, setRoleCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!accessToken) return;
    try {
      const url = new URL("/api/cache/status", apiBase);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setRoleCount(typeof json.roleCount === "number" ? json.roleCount : null);
      if (json.lastUpdatedUtc) {
        const dt = new Date(json.lastUpdatedUtc);
        setLastUpdated(
          isNaN(dt.getTime())
            ? String(json.lastUpdatedUtc)
            : dt.toLocaleString()
        );
      } else setLastUpdated(null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(fetchStatus, 60_000);
    return () => clearInterval(id);
  }, [accessToken]);

  const refreshCache = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const url = new URL("/api/cache/refresh", apiBase);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      // Immediately fetch new status
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Role definitions in cache</span>
        <span className="font-medium">{roleCount ?? "-"}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Cache last update</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{lastUpdated ?? "-"}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={refreshCache}
            aria-label="Refresh role cache"
            title="Refresh role cache"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </>
  );
}

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
  // Import confirmation modal state
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [selected, setSelected] = useState<DirectoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusableRef = useRef<HTMLButtonElement | null>(null);
  const [openSearch, setOpenSearch] = useState(false);
  const lastCacheInitAttempt = useRef<number>(0);
  const SIDEBAR_FOCUS_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
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

    const ensureCacheFresh = async (token: string) => {
      // Debounce attempts (once every 2 minutes max)
      const now = Date.now();
      if (now - lastCacheInitAttempt.current < 120_000) return;
      lastCacheInitAttempt.current = now;
      try {
        const statusUrl = new URL("/api/cache/status", apiBase);
        const res = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const roleCount =
          typeof json.roleCount === "number" ? json.roleCount : 0;
        const lastUpdatedUtc = json.lastUpdatedUtc
          ? Date.parse(json.lastUpdatedUtc)
          : null;
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const stale = !lastUpdatedUtc || Date.now() - lastUpdatedUtc > weekMs;
        if (roleCount === 0 || stale) {
          const refreshUrl = new URL("/api/cache/refresh", apiBase);
          await fetch(refreshUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // ignore silently
      }
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
        void ensureCacheFresh(result.accessToken);
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
  const refreshCache = async () => {
    if (!accessToken) {
      toast.error("Missing access token");
      return;
    }
    try {
      const url = new URL("/api/cache/refresh", apiBase);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Cache refresh triggered");
    } catch (e) {
      toast.error("Failed to refresh cache");
    }
  };

  // Restore persisted drawer state (optional persistence)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("er.drawerOpen");
      if (saved === "1") setSidebarOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist drawer state
  useEffect(() => {
    try {
      localStorage.setItem("er.drawerOpen", sidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return;
    const sidebar = document.querySelector(
      '[data-sidebar="true"]'
    ) as HTMLElement | null;
    if (!sidebar) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus first focusable within sidebar
    const focusables = Array.from(
      sidebar.querySelectorAll(SIDEBAR_FOCUS_SELECTOR)
    ) as HTMLElement[];
    if (focusables.length) {
      focusables[0].focus();
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        previouslyFocused?.focus();
        return;
      }
      if (e.key === "Tab") {
        const items = Array.from(
          sidebar.querySelectorAll(SIDEBAR_FOCUS_SELECTOR)
        ) as HTMLElement[];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top banner (only when authenticated) */}
      {authed && (
        <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 w-9 rounded border hover:bg-accent/20"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                ref={firstFocusableRef}
              >
                <Menu className="h-5 w-5" />
              </button>
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
              <div className="hidden md:flex items-center gap-6 ml-6 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground/80">
                    Reviewer:
                  </span>{" "}
                  {reviewerName || "-"}
                </span>
                <span>
                  <span className="font-medium text-foreground/80">
                    Domain:
                  </span>{" "}
                  {tenantDomain || "-"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {authed && (
                <CacheStatusChip accessToken={accessToken} apiBase={apiBase} />
              )}
              <div className="md:hidden flex flex-col items-end mr-2 text-[10px] leading-tight text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground/80">
                    Reviewer:
                  </span>{" "}
                  {reviewerName || "-"}
                </span>
                <span>
                  <span className="font-medium text-foreground/80">
                    Domain:
                  </span>{" "}
                  {tenantDomain || "-"}
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
          <div className="flex gap-6">
            <nav
              className={`fixed top-0 left-0 h-full w-64 bg-card text-card-foreground border-r z-50 flex flex-col will-change-transform ${
                sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
              } transition-transform duration-300 ease-in-out`}
              aria-label="Primary navigation"
              data-sidebar="true"
              role="dialog"
              aria-modal="true"
            >
              <div className="md:hidden flex items-center justify-between px-4 h-14 border-b">
                <span className="font-medium">Menu</span>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent/20"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation menu"
                  ref={lastFocusableRef}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-3 text-sm">
                  {(
                    [
                      { to: "/", label: "Review", icon: List },
                      { to: "/roles", label: "Role definitions", icon: Shield },
                      { to: "/config", label: "Configuration", icon: Settings },
                    ] as const
                  ).map((item, idx) => {
                    const ActiveIcon = item.icon;
                    const active = location.pathname === item.to;
                    const delayClass = sidebarOpen
                      ? ["delay-75", "delay-150", "delay-200"][idx] ||
                        "delay-75"
                      : "";
                    return (
                      <li key={item.to}>
                        <button
                          className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded transition-colors ${
                            active
                              ? "bg-accent/60 font-medium"
                              : "hover:bg-accent/40"
                          } opacity-0 translate-x-[-8px] ${
                            sidebarOpen
                              ? `animate-[drawerItem_.4s_forwards] ${delayClass}`
                              : ""
                          }`}
                          onClick={() => {
                            navigate(item.to);
                            setSidebarOpen(false);
                          }}
                          aria-current={active ? "page" : undefined}
                        >
                          <ActiveIcon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="border-t px-3 py-3 text-[10px] text-muted-foreground">
                v1 • {tenantDomain || ""}
              </div>
            </nav>
            {/* Overlay with fade animation */}
            <div
              className={`fixed inset-0 z-40 transition-opacity duration-300 ease-in-out ${
                sidebarOpen
                  ? "opacity-100 bg-black/40 backdrop-blur-sm"
                  : "pointer-events-none opacity-0"
              }`}
              aria-hidden="true"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="flex-1 space-y-6">
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
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
                                <Plus className="h-4 w-4 mr-2" /> Add users or
                                groups
                              </Button>
                            </div>
                          </div>
                          {subjectsOpen && (
                            <div className="p-4 sm:p-5 max-h-[50vh] overflow-y-auto">
                              {selected.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No subjects selected. Use “Add users or
                                  groups” to begin.
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
                                        <tr
                                          key={`${s.type}:${s.id}`}
                                          className="border-t"
                                        >
                                          <td className="p-2">
                                            {s.displayName}
                                          </td>
                                          <td className="p-2 capitalize">
                                            {s.type}
                                          </td>
                                          <td className="p-2 text-right">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                              onClick={() =>
                                                setSelected((prev) =>
                                                  prev.filter(
                                                    (x) =>
                                                      !(
                                                        x.id === s.id &&
                                                        x.type === s.type
                                                      )
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

                        {/* Context panel removed */}
                      </div>

                      <Sheet open={openSearch} onOpenChange={setOpenSearch}>
                        <SheetContent side="right">
                          <SheetHeader>
                            <div className="flex items-center justify-between">
                              <SheetTitle>
                                Select user(s) or group(s)
                              </SheetTitle>
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
                              .filter(
                                (s) => s.type === "user" || s.type === "group"
                              )
                              .map((s) => `${s.type}:${s.id}`)}
                          />
                        </div>
                      </section>
                    </>
                  }
                />
                <Route
                  path="/roles"
                  element={
                    <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-medium tracking-wide">
                          Role definitions
                        </h2>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/")}
                        >
                          Back to review
                        </Button>
                      </div>
                      <RolesBrowser accessToken={accessToken} />
                    </section>
                  }
                />
                <Route
                  path="/config"
                  element={
                    <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
                      <h2 className="text-sm font-medium tracking-wide">
                        Configuration
                      </h2>
                      <div className="grid gap-3 text-sm max-w-md">
                        <CacheStatus accessToken={accessToken} />
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!accessToken}
                            onClick={async () => {
                              if (!accessToken) return;
                              try {
                                const res = await fetch(
                                  new URL(
                                    "/api/operations/map/export",
                                    import.meta.env.VITE_API_URL
                                  ),
                                  {
                                    headers: {
                                      Authorization: `Bearer ${accessToken}`,
                                    },
                                  }
                                );
                                if (!res.ok) return;
                                const json = await res.json();
                                const blob = new Blob(
                                  [JSON.stringify(json, null, 2)],
                                  { type: "application/json" }
                                );
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                const ts = new Date();
                                const pad = (n: number) =>
                                  n.toString().padStart(2, "0");
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
                                // ignore
                              }
                            }}
                          >
                            Export operation mappings
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            Download current operation-to-permissions mapping as
                            seed JSON.
                          </p>
                        </div>
                        <div>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                            }}
                            className="space-y-2"
                          >
                            <label className="text-xs font-medium">
                              Import operation mappings
                            </label>
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
                            <p className="text-xs text-muted-foreground">
                              Upload a JSON seed file mapping operations to
                              actions. Existing operations are replaced.
                            </p>
                          </form>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Additional configuration options will appear here in
                        future versions.
                      </p>
                    </section>
                  }
                />
              </Routes>
            </div>
          </div>
        )}
      </main>
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
                      new URL(
                        "/api/operations/map/import",
                        import.meta.env.VITE_API_URL
                      ),
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
    </div>
  );
}
