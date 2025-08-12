import { useEffect, useState, useMemo } from "react";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";

export type DirectoryItem = {
  id: string;
  displayName: string;
  type: "user" | "group";
};

export function SearchUsers({
  accessToken,
  selected,
  onChange,
}: {
  accessToken: string | null;
  selected: DirectoryItem[];
  onChange: (v: DirectoryItem[]) => void;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [includeGroups, setIncludeGroups] = useState(true);
  const [results, setResults] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce the query to avoid excessive API calls while typing
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const ctrl = new AbortController();
    let canceled = false;
    const run = async () => {
      if (!accessToken || debouncedQ.trim().length < 2) {
        setResults([]);
        return;
      }
      const url = new URL("/api/search", import.meta.env.VITE_API_URL);
      url.searchParams.set("q", debouncedQ);
      url.searchParams.set("includeGroups", String(includeGroups));
      try {
        setLoading(true);
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!canceled) setResults(data);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => {
      canceled = true;
      ctrl.abort();
    };
  }, [debouncedQ, includeGroups, accessToken]);

  const add = (item: DirectoryItem) => {
    if (selected.some((s) => s.id === item.id && s.type === item.type)) return;
    onChange([...selected, item]);
  };
  const remove = (id: string, type: "user" | "group") =>
    onChange(selected.filter((s) => !(s.id === id && s.type === type)));

  const isSelected = (item: DirectoryItem) =>
    selected.some((s) => s.id === item.id && s.type === item.type);

  const addAll = () => {
    const existingKeys = new Set(selected.map((s) => s.id + "|" + s.type));
    const merged = [
      ...selected,
      ...results.filter((r) => !existingKeys.has(r.id + "|" + r.type)),
    ];
    onChange(merged);
  };

  const hasAddable = useMemo(
    () => results.some((r) => !isSelected(r)),
    [results, selected]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 items-Left">
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users or groups"
            className="w-96 pr-9"
            disabled={loading}
            aria-busy={loading}
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={includeGroups}
            onCheckedChange={(v) => setIncludeGroups(Boolean(v))}
            disabled={loading}
          />
          <span>Include groups</span>
        </label>
      </div>
      {(loading || results.length > 0) && (
        <div
          className="border rounded p-2 max-w-xl bg-card text-card-foreground"
          aria-live="polite"
        >
          {loading && results.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching…</span>
            </div>
          )}
          {!loading && results.length > 0 && hasAddable && (
            <div className="flex justify-end mb-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={addAll}
                disabled={loading}
              >
                Add all
              </Button>
            </div>
          )}
          {results.map((r) => (
            <div key={r.id} className="flex justify-between items-center py-1">
              <div>
                <span className="font-medium">{r.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.type}
                </span>
              </div>
              {isSelected(r) ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => remove(r.id, r.type)}
                  disabled={loading}
                >
                  Remove
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => add(r)}
                  disabled={loading}
                >
                  Add
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
