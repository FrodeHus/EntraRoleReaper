import { useMemo } from "react";

// Hook to obtain the API base URL. Falls back to empty string if missing.
export function useApiBase() {
  return useMemo(() => (import.meta.env.VITE_API_URL as string) || "", []);
}
