import { X as CloseIcon } from "lucide-react";
import { Settings, List } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { forwardRef } from "react";

interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
  tenantDomain: string;
  lastFocusableRef: React.RefObject<HTMLButtonElement>;
}

export const SidebarNav = forwardRef<HTMLDivElement, SidebarNavProps>(
  function SidebarNav({ open, onClose, tenantDomain, lastFocusableRef }, _ref) {
    const navigate = useNavigate();
    const location = useLocation();
    const items = [
      { to: "/", label: "Review", icon: List },
      { to: "/config", label: "Configuration", icon: Settings },
    ] as const;

    return (
      <nav
        className={`fixed top-0 left-0 h-full w-64 bg-card text-card-foreground border-r z-50 flex flex-col will-change-transform ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
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
            onClick={onClose}
            aria-label="Close navigation menu"
            ref={lastFocusableRef}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3 text-sm">
            {items.map((item, idx) => {
              const ActiveIcon = item.icon;
              const active = location.pathname === item.to;
              const delayClass = open
                ? ["delay-75", "delay-150", "delay-200"][idx] || "delay-75"
                : "";
              return (
                <li key={item.to}>
                  <button
                    className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded transition-colors ${
                      active ? "bg-accent/60 font-medium" : "hover:bg-accent/40"
                    } opacity-0 translate-x-[-8px] ${
                      open
                        ? `animate-[drawerItem_.4s_forwards] ${delayClass}`
                        : ""
                    }`}
                    onClick={() => {
                      navigate(item.to);
                      onClose();
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
    );
  }
);
