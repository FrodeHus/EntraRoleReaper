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

  if (!authed) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-2">Entra Role Auditor</h1>
        <p className="mb-6">Sign in to start reviewing access.</p>
        <Button onClick={login}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entra Role Auditor</h1>
        <div className="flex items-center gap-2">
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
    </div>
  );
}
