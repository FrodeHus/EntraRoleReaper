import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { RoleDetailsSheet } from "./review/RoleDetailsSheet";
import type { RoleDetails } from "./review/types";

export interface RoleSummaryItem {
  id: string;
  displayName: string;
  isBuiltIn: boolean;
  isEnabled: boolean;
  resourceScope: string | null;
  privileged: boolean;
}

interface PageResult {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: RoleSummaryItem[];
}

interface Props {
  accessToken: string | null;
}

export function RolesBrowser({ accessToken }: Props) {
  const [items, setItems] = useState<RoleSummaryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [sort, setSort] = useState("displayName");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [privOnly, setPrivOnly] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [roleDetails, setRoleDetails] = useState<RoleDetails>(null);
  const [detailsRoleMeta, setDetailsRoleMeta] = useState<{ name: string; requiredPerms: string[] } | null>(null);
  // role details cache (id -> RoleDetails object)
  const roleDetailsCacheRef = useRef<Map<string, RoleDetails>>(new Map());
  // simple in-memory + session persistence cache keyed by param signature
  const cacheRef = useRef<Map<string, { pages: Record<number, RoleSummaryItem[]>; totalPages: number | null; etag?: string }>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const etagRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const paramKey = () => `${search}|${sort}|${dir}|${privOnly}|${pageSize}`;

  const loadFromCache = (key: string) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return false;
    const assembled: RoleSummaryItem[] = [];
    const pages = Object.keys(entry.pages)
      .map(Number)
      .sort((a, b) => a - b);
    for (const p of pages) assembled.push(...entry.pages[p]);
    setItems(assembled);
    setTotalPages(entry.totalPages);
    etagRef.current = entry.etag || null;
    setPage(pages.length === 0 ? 1 : pages[pages.length - 1]);
    return true;
  };

  const persistPrefs = () => {
    try {
      const prefs = { sort, dir, privOnly, search };
      localStorage.setItem("rolesBrowserPrefs", JSON.stringify(prefs));
    } catch { /* ignore */ }
  };

  // load prefs once
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rolesBrowserPrefs");
      if (raw) {
        const prefs = JSON.parse(raw);
        if (typeof prefs.sort === "string") setSort(prefs.sort);
        if (prefs.dir === "asc" || prefs.dir === "desc") setDir(prefs.dir);
        if (typeof prefs.privOnly === "boolean") setPrivOnly(prefs.privOnly);
        if (typeof prefs.search === "string") { setSearch(prefs.search); setPendingSearch(prefs.search); }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(persistPrefs, [sort, dir, privOnly, search]);

  const resetAndLoad = () => {
    setItems([]);
    setPage(1);
    setTotalPages(null);
    etagRef.current = null;
    const key = paramKey();
    if (!loadFromCache(key)) void loadPage(1, true, key);
  };

  const loadPage = useCallback(
    async (target: number, replace = false, keyOverride?: string) => {
      if (!accessToken) return;
      if (loading) return;
      if (totalPages !== null && target > totalPages) return;
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const url = new URL("/api/roles/summary", import.meta.env.VITE_API_URL);
        url.searchParams.set("page", String(target));
        url.searchParams.set("pageSize", String(pageSize));
        url.searchParams.set("sort", sort);
        url.searchParams.set("dir", dir);
        if (search.trim()) url.searchParams.set("search", search.trim());
        if (privOnly) url.searchParams.set("privilegedOnly", "true");
        const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  // Only send conditional request for first page to avoid 304 responses blocking subsequent pages
  if (target === 1 && etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(url, { headers, signal: ac.signal });
  if (res.status === 304) {
          // No changes; just advance page pointer if append
          if (!replace) setPage(target);
          return;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        const etag = res.headers.get("etag");
        if (etag) etagRef.current = etag;
        const json: PageResult = await res.json();
        setTotalPages(json.totalPages);
        setPage(json.page);
        setItems((prev) => {
          const merged = replace ? json.items : [...prev, ...json.items];
          const sig = keyOverride || paramKey();
            const existing = cacheRef.current.get(sig) || { pages: {}, totalPages: json.totalPages || null };
            existing.pages[json.page] = json.items;
            existing.totalPages = json.totalPages;
            existing.etag = etagRef.current || existing.etag;
            cacheRef.current.set(sig, existing);
          return merged;
        });
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Failed to load roles");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, dir, loading, pageSize, privOnly, search, sort, totalPages]
  );

  // Initial load when authenticated
  useEffect(() => {
    if (accessToken) {
      resetAndLoad();
    } else {
      setItems([]);
      setTotalPages(null);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Apply search debounce
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(pendingSearch);
    }, 350);
    return () => clearTimeout(id);
  }, [pendingSearch]);

  // Reload on search / sort / filter changes
  useEffect(() => {
    if (!accessToken) return;
    resetAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, dir, privOnly]);

  const hasMore = totalPages === null || page < (totalPages || 0);

  const next = () => {
    if (!loading && hasMore) void loadPage(page + 1);
  };

  const fetchRoleDetails = async (id: string, name: string) => {
    if (!accessToken) return;
    setDetailsRoleMeta({ name, requiredPerms: [] });
    setRoleDetails(null);
    setDetailsLoading(true);
    // Serve from cache if present
    if (roleDetailsCacheRef.current.has(id)) {
      setRoleDetails(roleDetailsCacheRef.current.get(id)!);
      setDetailsLoading(false);
      setDetailsOpen(true);
      return;
    }
    setDetailsOpen(true);
    try {
      const url = new URL(`/api/roles/${encodeURIComponent(id)}`, import.meta.env.VITE_API_URL);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRoleDetails({
        id: json.id,
        name: json.displayName || json.name,
        description: json.description,
        resourceScopes: json.resourceScopes || [],
        resourceScopesDetailed: json.resourceScopesDetailed || [],
        permissions: (json.permissions || []).map((p: any) => ({ action: p.action || p, privileged: !!p.privileged }))
      });
      // Cache
      roleDetailsCacheRef.current.set(id, {
        id: json.id,
        name: json.displayName || json.name,
        description: json.description,
        resourceScopes: json.resourceScopes || [],
        resourceScopesDetailed: json.resourceScopesDetailed || [],
        permissions: (json.permissions || []).map((p: any) => ({ action: p.action || p, privileged: !!p.privileged }))
      });
    } catch (e) {
      setRoleDetails({
        name,
        description: 'Failed to load details',
        permissions: []
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) next();
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [next, sentinelRef, hasMore]);

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("asc");
    }
  };

  const visible = useMemo(() => items, [items]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground" htmlFor="rb-search">
            Search
          </label>
          <Input
            id="rb-search"
            placeholder="Display name contains…"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Privileged</label>
          <button
            type="button"
            className={`h-8 px-3 text-sm rounded border ${privOnly ? "bg-red-600 text-white" : "bg-background"}`}
            onClick={() => setPrivOnly((p) => !p)}
            aria-label={privOnly ? "Show all roles" : "Show only privileged roles"}
          >
            {privOnly ? "Only privileged" : "All"}
          </button>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Sort</label>
          <select
            className="h-8 border rounded px-2 bg-background text-foreground"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort field"
          >
            <option value="displayName">Name</option>
            <option value="builtin">Built-in</option>
            <option value="enabled">Enabled</option>
            <option value="privileged">Privileged</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Dir</label>
          <button
            className="h-8 px-3 text-sm rounded border"
            onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {dir === "asc" ? "Asc" : "Desc"}
          </button>
        </div>
      </div>
      <div className="border rounded bg-card/50 overflow-hidden">
        <table className="w-full text-xs md:text-sm relative">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort("displayName")}>Name</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort("builtin")}>Built-in</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort("enabled")}>Enabled</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort("privileged")}>Privileged</th>
              <th className="text-left p-2">Scope</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-medium">
                  <button
                    type="button"
                    className="text-left text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded"
                    onClick={() => fetchRoleDetails(r.id, r.displayName)}
                    title="View role details"
                  >
                    {r.displayName}
                  </button>
                </td>
                <td className="p-2">{r.isBuiltIn ? "Yes" : "No"}</td>
                <td className="p-2">{r.isEnabled ? "Yes" : "No"}</td>
                <td className="p-2">{r.privileged ? <span className="inline-block rounded px-2 py-0.5 bg-red-600 text-white text-[10px] md:text-xs">Priv</span> : "-"}</td>
                <td className="p-2 truncate max-w-[10rem]" title={r.resourceScope || ""}>{r.resourceScope || ""}</td>
              </tr>
            ))}
            {visible.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No roles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
  <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-2">
          {totalPages !== null && <span>Page {page} / {totalPages}</span>}
          <span>{items.length} loaded</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="h-8 px-3 text-sm rounded border"
            disabled={loading || !hasMore}
            onClick={() => next()}
            type="button"
            aria-label={hasMore ? "Load more roles" : "All roles loaded"}
          >
            {loading ? "Loading…" : hasMore ? "Load more" : "All loaded"}
          </button>
        </div>
      </div>
      <div ref={sentinelRef} aria-hidden className="h-1 w-full"></div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-t-transparent border-border animate-spin" aria-hidden></span>
          Loading…
        </div>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
      <RoleDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        role={detailsRoleMeta}
        details={roleDetails}
        loading={detailsLoading}
      />
    </div>
  );
}
