import { useEffect, useRef, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { ReviewPage } from "./pages/ReviewPage";
import { ConfigPage } from "./pages/ConfigPage";
import { AppHeader } from "./components/AppHeader";
import { SidebarNav } from "./components/SidebarNav";
import { WelcomeCard } from "./components/WelcomeCard";
import { useTheme } from "./hooks/useTheme";
import { useAccessToken } from "./hooks/useAccessToken";
const apiScopeEnv = import.meta.env.VITE_API_SCOPE as string;
const apiBase = import.meta.env.VITE_API_URL as string;
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

// apiBase constant retained for passing to components expecting explicit base.

export default function App() {
  const { instance, accounts } = useMsal();
  const authed = useIsAuthenticated();
  const { theme, toggleTheme } = useTheme();
  const { accessToken } = useAccessToken();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusableRef = useRef<HTMLButtonElement | null>(null);
  // Focus trap helpers
  const SIDEBAR_FOCUS_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const reviewerName = accounts[0]?.name || accounts[0]?.username || "";
  const tenantDomain = (() => {
    const upn = accounts[0]?.username ?? "";
    const at = upn.indexOf("@");
    return at > -1 ? upn.slice(at + 1) : "";
  })();

  const login = () => instance.loginRedirect({ scopes: [apiScopeEnv] });
  const logout = () => instance.logoutRedirect();
  // toggleTheme provided by useTheme hook

  // Restore/persist drawer state
  useEffect(() => {
    try {
      if (localStorage.getItem("er.drawerOpen") === "1") setSidebarOpen(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("er.drawerOpen", sidebarOpen ? "1" : "0");
    } catch {}
  }, [sidebarOpen]);

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return;
    const sidebar = document.querySelector(
      '[data-sidebar="true"]'
    ) as HTMLElement | null;
    if (!sidebar) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = Array.from(
      sidebar.querySelectorAll(SIDEBAR_FOCUS_SELECTOR)
    ) as HTMLElement[];
    if (focusables.length) focusables[0].focus();
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
      <AppHeader
        authed={authed}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSidebar={() => setSidebarOpen(true)}
        reviewerName={reviewerName}
        tenantDomain={tenantDomain}
        accessToken={accessToken}
        apiBase={apiBase}
        onLogout={logout}
        firstFocusableRef={firstFocusableRef}
      />
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
        {!authed ? (
          <div className="py-16 flex items-center justify-center">
            <WelcomeCard onSignIn={login} />
          </div>
        ) : (
          <div className="flex gap-6">
            <SidebarNav
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              tenantDomain={tenantDomain}
              lastFocusableRef={lastFocusableRef}
            />
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
                  element={<ReviewPage accessToken={accessToken} />}
                />
                <Route
                  path="/config"
                  element={
                    <ConfigPage accessToken={accessToken} apiBase={apiBase} />
                  }
                />
              </Routes>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
