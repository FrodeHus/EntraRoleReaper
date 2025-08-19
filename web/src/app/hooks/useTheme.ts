import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

// Hook that manages theme mode (light/dark/system) and applies the resolved theme to <html>
export function useTheme() {
  const getInitialMode = (): ThemeMode => {
    if (typeof window === "undefined") return "light";
    // migrate legacy key
    const legacy = localStorage.getItem("theme");
    const stored = (localStorage.getItem("themeMode") ||
      legacy) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
    return "system";
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  // Track system prefers-color-scheme for resolved theme when in system mode
  const media = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
        : null,
    []
  );

  const resolvedTheme =
    mode === "system" ? (media?.matches ? "dark" : "light") : mode;

  // Apply class to document root when resolved theme changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [resolvedTheme]);

  // Persist mode (not resolved theme)
  useEffect(() => {
    try {
      localStorage.setItem("themeMode", mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  // Listen for system changes when in system mode
  useEffect(() => {
    if (!media) return;
    const handler = () => {
      if (mode === "system") {
        // trigger update by setting state to same value
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        media.matches; // referenced to satisfy lint
        setMode((m) => m);
      }
    };
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, [media, mode]);

  const toggle = useCallback(
    () => setMode((m) => (m === "dark" ? "light" : "dark")),
    []
  );

  return { mode, setMode, resolvedTheme, toggle } as const;
}
