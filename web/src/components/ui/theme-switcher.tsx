import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { useTheme, type ThemeMode } from "../../app/hooks/useTheme";

// A minimal shadcn-like theme switcher with a small popover menu for Light/Dark/System
export function ThemeSwitcher() {
  const { mode, setMode, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // Close on escape and outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (!(el.closest && el.closest("[data-theme-switcher]"))) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  const set = (m: ThemeMode) => {
    setMode(m);
    setOpen(false);
  };

  return (
    <div className="relative" data-theme-switcher>
      <Button
        variant="outline"
        size="icon"
        aria-label="Theme switcher"
        title={`Theme: ${mode}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 rounded-md border bg-popover text-popover-foreground shadow-md z-50 overflow-hidden">
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/40 inline-flex items-center gap-2 ${mode === "light" ? "bg-accent/20" : ""}`}
            onClick={() => set("light")}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/40 inline-flex items-center gap-2 ${mode === "dark" ? "bg-accent/20" : ""}`}
            onClick={() => set("dark")}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/40 inline-flex items-center gap-2 ${mode === "system" ? "bg-accent/20" : ""}`}
            onClick={() => set("system")}
          >
            <Laptop className="h-4 w-4" /> System
          </button>
        </div>
      )}
    </div>
  );
}
