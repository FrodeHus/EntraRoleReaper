import { useEffect, useState } from 'react'
import { Sun, Moon } from "lucide-react";
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
    const getToken = async () => {
      if (!authed || accounts.length === 0) return;
      try {
        const result = await instance.acquireTokenSilent({
          scopes: [apiScope],
          account: accounts[0],
        });
        setAccessToken(result.accessToken);
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenRedirect({ scopes: [apiScope] });
        }
      }
    };
    getToken();
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
            <span className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Entra Role Assignment Auditor
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
          <div className="py-12">
            <h1 className="text-2xl font-semibold mb-2">Welcome</h1>
            <p className="mb-6 text-muted-foreground">
              Sign in to start reviewing access.
            </p>
            <Button onClick={login}>Sign in</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <Button onClick={() => setOpenSearch(true)}>
                Select user(s) or group(s)
              </Button>
              {selected.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Selected</h3>
                    <Button
                      variant="link"
                      className="text-sm"
                      onClick={() => setSelected([])}
                      aria-label="Clear selected users and groups"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.map((s) => (
                      <span
                        key={`${s.type}:${s.id}`}
                        className="px-2 py-1 rounded text-sm bg-secondary text-secondary-foreground"
                      >
                        {s.displayName}
                        <button
                          className="ml-2 text-muted-foreground hover:text-foreground"
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
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Sheet open={openSearch} onOpenChange={setOpenSearch}>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Select user(s) or group(s)</SheetTitle>
                </SheetHeader>
                <div className="mt-2">
                  <SearchUsers
                    accessToken={accessToken}
                    selected={selected}
                    onChange={setSelected}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <ReviewPanel
              accessToken={accessToken}
              selectedIds={selected.map((s) => `${s.type}:${s.id}`)}
            />
          </>
        )}
      </main>
    </div>
  );
}
