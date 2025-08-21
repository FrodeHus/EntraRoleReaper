import { useEffect, useRef, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { ReviewPage } from "./pages/ReviewPage";
import { ConfigPage } from "./pages/ConfigPage";
import { StatusNav } from "./components/StatusNav";
import { WelcomeCard } from "./components/WelcomeCard";
import { useTheme } from "./hooks/useTheme";
import { useAccessToken } from "./hooks/useAccessToken";
const apiScopeEnv = import.meta.env.VITE_API_SCOPE as string;
const apiBase = import.meta.env.VITE_API_URL as string;
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { OnboardPage } from "./pages/OnboardPage";
import { TenantPage } from "./pages/TenantPage";
import { RolesPage } from "./pages/RolesPage";
import { MappingsPage } from "./pages/MappingsPage";

// apiBase constant retained for passing to components expecting explicit base.

export default function App() {
  const { instance, accounts } = useMsal();
  const authed = useIsAuthenticated();
  const { resolvedTheme } = useTheme();
  const { accessToken } = useAccessToken();
  // Sidebar replaced by StatusNav; retain no sidebar state
  const navigate = useNavigate();
  const location = useLocation();
  const bannerState = (location.state as any) || null;
  const [showVerifyBanner, setShowVerifyBanner] = useState<boolean>(
    !!bannerState?.verifiedTenant
  );
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null); // no longer used
  const lastFocusableRef = useRef<HTMLButtonElement | null>(null); // no longer used
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

  // Sidebar removed; no drawer effects

  return (
    <div className="min-h-dvh flex flex-col">
      <StatusNav
        authed={authed}
        reviewerName={reviewerName}
        tenantDomain={tenantDomain}
        accessToken={accessToken}
        apiBase={apiBase}
        onLogout={logout}
      />
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
        {!authed ? (
          <div className="py-16">
            <Routes>
              <Route path="/onboard" element={<OnboardPage />} />
              <Route
                path="*"
                element={
                  <div className="flex items-center justify-center">
                    <WelcomeCard onSignIn={login} />
                  </div>
                }
              />
            </Routes>
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="flex-1 space-y-6">
              {showVerifyBanner && (
                <div className="rounded-md border border-green-500/30 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200 p-3 text-sm flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      Tenant verification successful
                    </div>
                    {bannerState?.verifiedTenant && (
                      <div className="text-xs mt-0.5">
                        {bannerState.verifiedTenant.name || "(unknown)"} (
                        {bannerState.verifiedTenant.domain || "-"})
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs underline hover:no-underline"
                    onClick={() => setShowVerifyBanner(false)}
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <Routes>
                <Route
                  path="/"
                  element={
                    <ReviewPage
                      accessToken={accessToken}
                      tenantDomain={tenantDomain}
                    />
                  }
                />
                <Route
                  path="/mappings"
                  element={
                    <MappingsPage accessToken={accessToken} apiBase={apiBase} />
                  }
                />
                <Route
                  path="/config"
                  element={
                    <ConfigPage accessToken={accessToken} apiBase={apiBase} />
                  }
                />
                <Route
                  path="/roles"
                  element={
                    <RolesPage accessToken={accessToken} apiBase={apiBase} />
                  }
                />
                <Route path="/tenant" element={<TenantPage />} />
                <Route path="/onboard" element={<OnboardPage />} />
              </Routes>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
