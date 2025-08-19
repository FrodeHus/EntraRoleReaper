import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

interface UserMenuProps {
  reviewerName: string;
  tenantDomain: string;
  onLogout: () => void;
}

export function UserMenu({ reviewerName, tenantDomain, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        className="h-8 w-8 rounded-full bg-accent/40 text-foreground inline-flex items-center justify-center font-medium"
        title={reviewerName || "User"}
      >
        {initials(reviewerName)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-md border bg-popover text-popover-foreground shadow-md z-50 overflow-hidden"
        >
          <div className="px-3 py-3 text-xs">
            <div className="text-foreground/80">Reviewer</div>
            <div className="truncate text-foreground text-sm" title={reviewerName}>{reviewerName || "-"}</div>
            <div className="mt-2 text-foreground/80">Domain</div>
            <div className="truncate text-foreground text-sm" title={tenantDomain}>{tenantDomain || "-"}</div>
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent/40 inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
