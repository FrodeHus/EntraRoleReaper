import { useEffect, useState } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser'
import { SearchUsers } from './SearchUsers'
import { ReviewPanel } from './ReviewPanel'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

const apiScope = import.meta.env.VITE_API_SCOPE as string;
const apiBase = import.meta.env.VITE_API_URL as string;

export default function App() {
  const { instance, inProgress, accounts } = useMsal();
  const authed = useIsAuthenticated();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    { id: string; displayName: string; type: "user" | "group" }[]
  >([]);
  const [openSearch, setOpenSearch] = useState(false);

  useEffect(() => {
    const getToken = async () => {
      if (!authed || accounts.length === 0) return;
      try {
        const result = await instance.acquireTokenSilent({
          scopes: [apiScope],
          account: accounts[0],
        });
        setAccessToken(result.accessToken);
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          await instance.acquireTokenRedirect({ scopes: [apiScope] });
        }
      }
    };
    getToken();
  }, [authed, accounts, instance]);

  const login = () => instance.loginRedirect({ scopes: [apiScope] });
  const logout = () => instance.logoutRedirect();

  if (!authed) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-2">Entra Role Auditor</h1>
        <p className="mb-6">Sign in to start reviewing access.</p>
        <button
          onClick={login}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entra Role Auditor</h1>
        <button onClick={logout} className="px-3 py-1.5 bg-gray-200 rounded">
          Sign out
        </button>
      </div>
      <div className="space-y-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => setOpenSearch(true)}
        >
          Select user(s) or group(s)
        </button>
        {selected.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Selected</h3>
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setSelected([])}
                aria-label="Clear selected users and groups"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map((s) => (
                <span
                  key={`${s.type}:${s.id}`}
                  className="px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  {s.displayName}
                  <button
                    className="ml-2 text-gray-600 hover:text-gray-900"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.filter(
                          (x) => !(x.id === s.id && x.type === s.type)
                        )
                      )
                    }
                    aria-label={`Remove ${s.displayName}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={openSearch} onOpenChange={setOpenSearch}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Select user(s) or group(s)</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            <SearchUsers
              accessToken={accessToken}
              selected={selected}
              onChange={setSelected}
            />
          </div>
        </SheetContent>
      </Sheet>
      <ReviewPanel
        accessToken={accessToken}
        selectedIds={selected.map((s) => `${s.type}:${s.id}`)}
      />
    </div>
  );
}
