import { Sun, Moon, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { CacheStatusChip } from "../CacheStatusChip";

interface AppHeaderProps {
  authed: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
  reviewerName: string;
  tenantDomain: string;
  accessToken: string | null;
  apiBase: string;
  onLogout: () => void;
  firstFocusableRef: React.RefObject<HTMLButtonElement>;
}

export function AppHeader({ authed, theme, onToggleTheme, onOpenSidebar, reviewerName, tenantDomain, accessToken, apiBase, onLogout, firstFocusableRef }: AppHeaderProps) {
  if (!authed) return null;
  return (
    <header className="sticky top-0 z-40 border-b bg-card backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 w-9 rounded border hover:bg-accent/20"
            onClick={onOpenSidebar}
            aria-label="Open navigation menu"
            ref={firstFocusableRef}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded"
          >
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
          </Link>
          <div className="hidden md:flex items-center gap-6 ml-6 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground/80">Reviewer:</span>{" "}
              {reviewerName || "-"}
            </span>
            <span>
              <span className="font-medium text-foreground/80">Domain:</span>{" "}
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
              <span className="font-medium text-foreground/80">Reviewer:</span>{" "}
              {reviewerName || "-"}
            </span>
            <span>
              <span className="font-medium text-foreground/80">Domain:</span>{" "}
              {tenantDomain || "-"}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
