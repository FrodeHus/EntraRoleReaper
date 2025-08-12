import { useMemo } from "react";

// Central hook to obtain the API scope (MSAL resource scope)
// Falls back to empty string if env var missing (consumer can decide to handle)
export function useApiScope() {
  return useMemo(() => (import.meta.env.VITE_API_SCOPE as string) || "", []);
}
