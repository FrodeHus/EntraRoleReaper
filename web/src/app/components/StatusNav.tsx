import { NavLink } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { CacheStatusChip } from "../CacheStatusChip";
import { UserMenu } from "../../components/ui/user-menu";
import { ThemeSwitcher } from "../../components/ui/theme-switcher";

interface StatusNavProps {
  authed: boolean;
  reviewerName: string;
  tenantDomain: string;
  accessToken: string | null;
  apiBase: string;
  onLogout: () => void;
}

export function StatusNav({ authed, reviewerName, tenantDomain, accessToken, apiBase, onLogout }: StatusNavProps) {
  if (!authed) return null;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded text-sm transition-colors ${isActive ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-accent/40"}`;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 overflow-visible">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 grid grid-cols-2 sm:grid-cols-3 items-center gap-2">
        {/* left: brand */}
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}entrarolereaper_logo.png`}
            alt="RoleReaper"
            className="h-16 w-16 translate-y-1.5 drop-shadow-sm"
          />
          <span className="text-sm sm:text-base font-semibold tracking-tight">
            Entra RoleReaper
          </span>
        </div>

        {/* center: nav */}
        <nav className="hidden sm:flex items-center justify-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Review
          </NavLink>
          <NavLink to="/config" className={linkClass}>
            Configuration
          </NavLink>
          <NavLink to="/tenant" className={linkClass}>
            Tenant
          </NavLink>
        </nav>

        {/* right: status/actions */}
        <div className="flex items-center justify-end gap-2">
          <CacheStatusChip accessToken={accessToken} apiBase={apiBase} />
          <ThemeSwitcher />
          <UserMenu
            reviewerName={reviewerName}
            tenantDomain={tenantDomain}
            onLogout={onLogout}
          />
        </div>
      </div>
      {/* mobile nav */}
      <nav className="sm:hidden border-t">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-10 flex items-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Review
          </NavLink>
          <NavLink to="/config" className={linkClass}>
            Configuration
          </NavLink>
          <NavLink to="/tenant" className={linkClass}>
            Tenant
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
