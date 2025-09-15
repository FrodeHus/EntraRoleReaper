import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { toast } from "sonner";
import { X, Layers } from "lucide-react";

interface RolePermissionActionDto { id: string; action: string; privileged: boolean; }
interface RolePermissionSetDto { condition?: string | null; actions: RolePermissionActionDto[] }
interface RoleSummaryDto { id: string; displayName: string; description: string; isBuiltIn: boolean; permissionSets: { id?: string; condition?: string | null; resourceActions?: { id: string; action: string; isPrivileged: boolean }[] }[] }
interface GetRoleResponse { id: string; displayName: string; description: string; rolePermissions: RolePermissionSetDto[]; }

interface ResourceActionSearchItem { id: string; action: string; isPrivileged: boolean }

export function RoleEditorPage({ accessToken, apiBase }: { accessToken: string | null; apiBase: string; }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = !!id;

  const [loading, setLoading] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [isBuiltIn, setIsBuiltIn] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [selectedActions, setSelectedActions] = useState<ResourceActionSearchItem[]>([]);
  const selectedActionIds = useMemo(() => new Set(selectedActions.map(a => a.id)), [selectedActions]);

  // Resource action search
  const [actionQuery, setActionQuery] = useState("");
  const [actionResults, setActionResults] = useState<ResourceActionSearchItem[]>([]);
  const [searchingActions, setSearchingActions] = useState(false);

  // Combinator modal
  const [combinatorOpen, setCombinatorOpen] = useState(false);
  const [cloneSearch, setCloneSearch] = useState("");
  const [subtractSearch, setSubtractSearch] = useState("");
  const [roleSearchLoading, setRoleSearchLoading] = useState(false);
  const [cloneCandidates, setCloneCandidates] = useState<RoleSummaryDto[]>([]);
  const [subtractCandidates, setSubtractCandidates] = useState<RoleSummaryDto[]>([]);
  const [cloneRoles, setCloneRoles] = useState<RoleSummaryDto[]>([]);
  const [subtractRoles, setSubtractRoles] = useState<RoleSummaryDto[]>([]);
  // Combobox dropdown visibility
  const [cloneOpen, setCloneOpen] = useState(false);
  const [subtractOpen, setSubtractOpen] = useState(false);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const subtractRef = useRef<HTMLDivElement | null>(null);

  // Preview filters
  const [addFilters, setAddFilters] = useState({ included: true, subtracted: true, suppressed: true });
  const [removeFilters, setRemoveFilters] = useState({ effective: true, kept: true, noEffect: true });

  // Fetch existing role if editing
  useEffect(() => {
    if (!editing || !id || !accessToken || initialLoaded) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(new URL(`/api/roles/${id}`, apiBase), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error();
        const json: GetRoleResponse = await res.json();
        setRoleName(json.displayName);
        setDescription(json.description || "");
        // We need IsBuiltIn flag -> fetch summary single search by name as fallback
        const summaryRes = await fetch(new URL(`/api/roles/summary?search=${encodeURIComponent(json.displayName)}`, apiBase), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (summaryRes.ok) {
          const sJson = await summaryRes.json();
          const match = (sJson.roles || sJson.Roles || []).find((r: any) => r.id === id || r.id === json.id);
          if (match) setIsBuiltIn(match.isBuiltIn);
        }
        // flatten actions
        const acts: ResourceActionSearchItem[] = [];
        json.rolePermissions.forEach(ps => ps.actions.forEach(a => { if (!acts.some(x => x.id === a.id)) acts.push({ id: a.id, action: a.action, isPrivileged: a.privileged }); }));
        setSelectedActions(acts);
      } catch {
        toast.error("Failed to load role");
      } finally {
        setLoading(false);
        setInitialLoaded(true);
      }
    })();
  }, [editing, id, accessToken, apiBase, initialLoaded]);

  // Restrict editing built-in
  useEffect(() => {
    if (editing && isBuiltIn) {
      toast.warning("Built-in roles cannot be edited");
    }
  }, [editing, isBuiltIn]);

  const searchResourceActions = useCallback(async (q: string) => {
    if (!accessToken) return;
    try {
      setSearchingActions(true);
      const url = new URL("/api/resourceaction/search", apiBase);
      if (q.trim()) url.searchParams.set("q", q);
      url.searchParams.set("limit", "60");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error();
      const arr = await res.json() as Array<{ id: string; action: string; isPrivileged: boolean }>;
      setActionResults(arr);
    } catch {
      setActionResults([]);
    } finally {
      setSearchingActions(false);
    }
  }, [accessToken, apiBase]);

  useEffect(() => { const t = setTimeout(() => searchResourceActions(actionQuery), 300); return () => clearTimeout(t); }, [actionQuery, searchResourceActions]);

  function toggleAction(item: ResourceActionSearchItem) {
    setSelectedActions(prev => prev.some(a => a.id === item.id) ? prev.filter(a => a.id !== item.id) : [...prev, item]);
  }

  // Role search for combinator (shared helper)
  const searchRoles = useCallback(async (q: string, setFn: (r: RoleSummaryDto[]) => void) => {
    if (!accessToken) return; setRoleSearchLoading(true);
    try {
      const url = new URL("/api/roles/summary", apiBase);
      if (q) url.searchParams.set("search", q);
      url.searchParams.set("pageSize", "50");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list: RoleSummaryDto[] = (json.roles || json.Roles || []).map((r: any) => ({
        id: r.id, displayName: r.displayName, description: r.description, isBuiltIn: r.isBuiltIn, permissionSets: r.permissionSets || r.PermissionSets || []
      }));
      // Include all roles (built-in + custom) for combination source
      setFn(list);
    } catch { setFn([]); } finally { setRoleSearchLoading(false); }
  }, [accessToken, apiBase]);

  useEffect(() => { const t = setTimeout(() => searchRoles(cloneSearch, setCloneCandidates), 300); return () => clearTimeout(t); }, [cloneSearch, searchRoles]);
  useEffect(() => { const t = setTimeout(() => searchRoles(subtractSearch, setSubtractCandidates), 300); return () => clearTimeout(t); }, [subtractSearch, searchRoles]);

  // Close comboboxes on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cloneRef.current && !cloneRef.current.contains(e.target as Node)) setCloneOpen(false);
      if (subtractRef.current && !subtractRef.current.contains(e.target as Node)) setSubtractOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function addClone(role: RoleSummaryDto) { if (cloneRoles.some(r => r.id === role.id)) return; setCloneRoles(r => [...r, role]); }
  function addSubtract(role: RoleSummaryDto) { if (subtractRoles.some(r => r.id === role.id)) return; setSubtractRoles(r => [...r, role]); }
  function removeClone(id: string) { setCloneRoles(r => r.filter(x => x.id !== id)); }
  function removeSubtract(id: string) { setSubtractRoles(r => r.filter(x => x.id !== id)); }

  // Combination preview (diff)
  const [comboPreview, setComboPreview] = useState<null | {
    final: ResourceActionSearchItem[];
    additions: ResourceActionSearchItem[]; // raw clone union
    removals: ResourceActionSearchItem[]; // raw subtract union
    suppressedIds: string[]; // suppressed additions
    excludedReason: Record<string, 'suppressed' | 'subtracted'>; // additions not ending in final
    removalReason: Record<string, 'no-effect' | 'kept' | 'effective'>; // classification for raw removal entries
  }>(null);

  function computeCombinationPreview() {
    // Raw unions
    const cloneActions = new Map<string, ResourceActionSearchItem>();
    cloneRoles.forEach(r => r.permissionSets.forEach(ps => (ps.resourceActions || []).forEach(a => { if (!cloneActions.has(a.id)) cloneActions.set(a.id, { id: a.id, action: a.action, isPrivileged: a.isPrivileged }); })));
    const subtractActions = new Map<string, ResourceActionSearchItem>();
    subtractRoles.forEach(r => r.permissionSets.forEach(ps => (ps.resourceActions || []).forEach(a => { if (!subtractActions.has(a.id)) subtractActions.set(a.id, { id: a.id, action: a.action, isPrivileged: a.isPrivileged }); })));
    const subtractIds = new Set(subtractActions.keys());

    // Preliminary final before suppression
    const preliminary = [...cloneActions.values()].filter(a => !subtractIds.has(a.id));
    const currentIds = new Set(selectedActions.map(a => a.id));

    // Raw lists for preview
    const additions = [...cloneActions.values()];
    const removals = [...subtractActions.values()];

    // Suppressed candidates (clone actions that are subtracted but not currently selected) are tracked via exclusion logic later
    // Build removalBaseSet / removalFieldMap from subtract list (raw intent) + current selection removal effects
    const removalBaseSet = new Set(
      removals.map(r => {
        const parts = r.action.split('/');
        return parts.slice(0, parts.length - 1).join('/');
      })
    );
    const removalFieldMap = new Map<string, Set<string>>();
    removals.forEach(r => {
      const p = r.action.split('/');
      if (p.length >= 4) {
        const key = `${p[0]}/${p[1]}`;
        if (!removalFieldMap.has(key)) removalFieldMap.set(key, new Set());
        removalFieldMap.get(key)!.add(p[2]);
      }
    });

    const additionallyRemoved: ResourceActionSearchItem[] = [];
    const filteredFinal: ResourceActionSearchItem[] = [];
    preliminary.forEach(a => {
      const parts = a.action.split('/');
      const last = parts[parts.length - 1];
      const isWildcardBroadener = last === 'allTasks' || last === 'allProperties';
      const base = parts.slice(0, parts.length - 1).join('/');
      let suppress = false;
      if (isWildcardBroadener && removalBaseSet.has(base)) suppress = true;
      if (!suppress && parts.length >= 4 && parts[2] === 'allProperties') {
        const key = `${parts[0]}/${parts[1]}`;
        const removedFields = removalFieldMap.get(key);
        if (removedFields && [...removedFields].some(f => f !== 'allProperties')) suppress = true;
      }
      if (suppress) { additionallyRemoved.push(a); return; }
      filteredFinal.push(a);
    });

    const finalIdSet = new Set(filteredFinal.map(a => a.id));
    const suppressedIdSet = new Set(additionallyRemoved.map(a => a.id));
    const excludedReason: Record<string, 'suppressed' | 'subtracted'> = {};
    additions.forEach(a => {
      if (!finalIdSet.has(a.id)) {
        if (suppressedIdSet.has(a.id)) excludedReason[a.id] = 'suppressed';
        else if (subtractIds.has(a.id)) excludedReason[a.id] = 'subtracted';
      }
    });

    // Classify removal entries
    const removalReason: Record<string, 'no-effect' | 'kept' | 'effective'> = {};
    const cloneIdSet = new Set(additions.map(a => a.id));
    removals.forEach(r => {
      const inClone = cloneIdSet.has(r.id);
      const removedFromFinal = !finalIdSet.has(r.id); // if not in final, removal was effective if it was in prelim
      if (!inClone) removalReason[r.id] = 'no-effect';
      else if (inClone && removedFromFinal) removalReason[r.id] = 'effective';
      else removalReason[r.id] = 'kept';
    });

    setComboPreview({ final: filteredFinal, additions, removals, suppressedIds: additionallyRemoved.map(a => a.id), excludedReason, removalReason });
  }

  function applyCombinationConfirmed() {
    if (!comboPreview) return;
    setSelectedActions(comboPreview.final);
    setComboPreview(null);
    setCombinatorOpen(false);
    toast.success("Combination applied");
  }

  function resetPreview() { setComboPreview(null); }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium tracking-wide">{editing ? "Edit Role" : "Create Role"}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCombinatorOpen(true)} type="button"><Layers className="h-4 w-4 mr-1" /> Role combinator</Button>
          <Button variant="secondary" size="sm" type="button" onClick={() => navigate(-1)}>Back</Button>
          {/* Save button placeholder - future implementation */}
          <Button variant="default" size="sm" disabled title="Saving not yet implemented">Save</Button>
        </div>
      </div>
      {editing && isBuiltIn && (
        <div className="text-xs rounded border border-amber-400/40 bg-amber-100/40 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-2">Built-in roles cannot be edited. You may clone its actions using the Role combinator.</div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Role name</label>
              <Input value={roleName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoleName(e.target.value)} disabled={isBuiltIn} placeholder="Enter role name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Description</label>
              <textarea className="w-full rounded border bg-background px-2 py-1 text-sm h-28" value={description} onChange={e => setDescription(e.target.value)} disabled={isBuiltIn} placeholder="Describe this role" />
            </div>
          </CardContent>
        </Card>
        <Card className="md:row-span-2">
          <CardHeader><CardTitle className="text-sm">Resource actions ({selectedActions.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={actionQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActionQuery(e.target.value)} placeholder="Search actions" className="text-sm" />
              {actionQuery && (
                <Button variant="ghost" size="icon" type="button" onClick={() => setActionQuery("")}><X className="h-4 w-4" /></Button>
              )}
            </div>
            {actionResults.length > 0 && (
              <ul className="max-h-48 overflow-auto border rounded divide-y text-xs">
                {actionResults.map(a => (
                  <li key={a.id} className="flex items-center justify-between px-2 py-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedActionIds.has(a.id)} onCheckedChange={() => toggleAction(a)} />
                      <span className="font-mono truncate max-w-[300px]" title={a.action}>{a.action}</span>
                    </label>
                    {a.isPrivileged && <span className="text-[10px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-300">priv</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide">Selected actions</h4>
              {selectedActions.length === 0 && <div className="text-xs text-muted-foreground">None selected</div>}
              {selectedActions.length > 0 && (
                <ul className="max-h-64 overflow-auto border rounded divide-y text-xs">
                  {selectedActions.sort((a,b) => a.action.localeCompare(b.action)).map(a => (
                    <li key={a.id} className="flex items-center justify-between px-2 py-1">
                      <span className="font-mono truncate max-w-[360px]" title={a.action}>{a.action}</span>
                      <button type="button" className="text-rose-600 hover:underline" onClick={() => setSelectedActions(prev => prev.filter(x => x.id !== a.id))}>remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combinator Modal */}
      <Dialog open={combinatorOpen} onOpenChange={setCombinatorOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Role combinator</DialogTitle>
            <DialogDescription>Build a role by cloning actions from roles and subtracting others.</DialogDescription>
          </DialogHeader>
          {!comboPreview && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Clone combobox */}
            <div className="space-y-3">
              <div ref={cloneRef} className="relative">
                <div className="flex items-center gap-2">
                  <Input
                    value={cloneSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCloneSearch(e.target.value); setCloneOpen(true); }}
                    onFocus={() => { setCloneOpen(true); if (!cloneSearch) setCloneSearch(''); }}
                    placeholder="Search roles to clone"
                    className="text-sm"
                    aria-expanded={cloneOpen}
                    aria-controls="clone-combobox-list"
                  />
                  {cloneSearch && <Button variant="ghost" size="icon" type="button" onClick={() => { setCloneSearch(''); setCloneOpen(true); }}> <X className="h-4 w-4" /> </Button>}
                </div>
                {cloneOpen && (
                  <div id="clone-combobox-list" role="listbox" aria-label="Clone role search results" className="absolute z-20 mt-1 w-full max-h-56 overflow-auto border rounded bg-background shadow text-xs divide-y">
                    {cloneCandidates.length === 0 && <div className="px-2 py-2 text-muted-foreground">No roles</div>}
                    {cloneCandidates.map(r => {
                      const selected = cloneRoles.some(c => c.id === r.id);
                      return (
                        <div
                          key={r.id}
                          role="option"
                          data-selected={selected ? 'true' : 'false'}
                          className={`px-2 py-1 cursor-pointer flex items-center justify-between hover:bg-accent ${selected ? 'opacity-50' : ''}`}
                          onMouseDown={(e) => { e.preventDefault(); if (!selected) { addClone(r); } setCloneOpen(false); }}
                        >
                          <span className="truncate" title={r.displayName}>{r.displayName}</span>
                          {!selected && <span className="text-[10px] border rounded px-1">add</span>}
                          {selected && <span className="text-[10px] px-1 text-muted-foreground">added</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium mb-1">Clone list ({cloneRoles.length})</h4>
                <ul className="border rounded max-h-40 overflow-auto divide-y text-xs">
                  {cloneRoles.map(r => (
                    <li key={r.id} className="flex items-center justify-between px-2 py-1">
                      <span className="truncate" title={r.displayName}>{r.displayName}</span>
                      <button type="button" onClick={() => removeClone(r.id)} className="text-rose-600 hover:underline">remove</button>
                    </li>
                  ))}
                  {cloneRoles.length === 0 && <li className="px-2 py-1 text-muted-foreground">Empty</li>}
                </ul>
              </div>
            </div>
            {/* Subtract combobox */}
            <div className="space-y-3">
              <div ref={subtractRef} className="relative">
                <div className="flex items-center gap-2">
                  <Input
                    value={subtractSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSubtractSearch(e.target.value); setSubtractOpen(true); }}
                    onFocus={() => { setSubtractOpen(true); if (!subtractSearch) setSubtractSearch(''); }}
                    placeholder="Search roles to subtract"
                    className="text-sm"
                    aria-expanded={subtractOpen}
                    aria-controls="subtract-combobox-list"
                  />
                  {subtractSearch && <Button variant="ghost" size="icon" type="button" onClick={() => { setSubtractSearch(''); setSubtractOpen(true); }}> <X className="h-4 w-4" /> </Button>}
                </div>
                {subtractOpen && (
                  <div id="subtract-combobox-list" role="listbox" aria-label="Subtract role search results" className="absolute z-20 mt-1 w-full max-h-56 overflow-auto border rounded bg-background shadow text-xs divide-y">
                    {subtractCandidates.length === 0 && <div className="px-2 py-2 text-muted-foreground">No roles</div>}
                    {subtractCandidates.map(r => {
                      const selected = subtractRoles.some(c => c.id === r.id);
                      return (
                        <div
                          key={r.id}
                          role="option"
                          data-selected={selected ? 'true' : 'false'}
                          className={`px-2 py-1 cursor-pointer flex items-center justify-between hover:bg-accent ${selected ? 'opacity-50' : ''}`}
                          onMouseDown={(e) => { e.preventDefault(); if (!selected) { addSubtract(r); } setSubtractOpen(false); }}
                        >
                          <span className="truncate" title={r.displayName}>{r.displayName}</span>
                          {!selected && <span className="text-[10px] border rounded px-1">add</span>}
                          {selected && <span className="text-[10px] px-1 text-muted-foreground">added</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-medium mb-1">Subtract list ({subtractRoles.length})</h4>
                <ul className="border rounded max-h-40 overflow-auto divide-y text-xs">
                  {subtractRoles.map(r => (
                    <li key={r.id} className="flex items-center justify-between px-2 py-1">
                      <span className="truncate" title={r.displayName}>{r.displayName}</span>
                      <button type="button" onClick={() => removeSubtract(r.id)} className="text-rose-600 hover:underline">remove</button>
                    </li>
                  ))}
                  {subtractRoles.length === 0 && <li className="px-2 py-1 text-muted-foreground">Empty</li>}
                </ul>
              </div>
            </div>
          </div>
          )}
          {comboPreview && (
            <div className="space-y-5">
              <div className="text-sm">
                <div className="font-medium mb-1">Preview changes</div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded p-2">
                    <h4 className="text-xs font-semibold mb-1 flex items-center justify-between">Add ({comboPreview.additions.length})
                      <button type="button" className="text-[10px] underline ml-2 opacity-70 hover:opacity-100" onClick={() => setAddFilters({ included: true, subtracted: true, suppressed: true })}>reset</button>
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-1">
                      {(['included','subtracted','suppressed'] as const).map(k => (
                        <label key={k} className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                          <Checkbox
                            checked={(addFilters as any)[k]}
                            onCheckedChange={() => setAddFilters(f => ({ ...f, [k]: !(f as any)[k] }))}
                          />
                          <span>{k}</span>
                        </label>
                      ))}
                    </div>
                    {comboPreview.additions.length === 0 && <div className="text-xs text-muted-foreground">None</div>}
                    {comboPreview.additions.length > 0 && (
                      <ul className="max-h-48 overflow-auto text-[11px] space-y-0.5">
                        {comboPreview.additions
                          .slice()
                          .sort((a,b)=>a.action.localeCompare(b.action))
                          .map(a => {
                            const reason = comboPreview.excludedReason[a.id];
                            const notInFinal = !!reason;
                            if (reason === 'suppressed' && !addFilters.suppressed) return null;
                            if (reason === 'subtracted' && !addFilters.subtracted) return null;
                            if (!reason && !addFilters.included) return null;
                            return (
                              <li
                                key={a.id}
                                className={`font-mono truncate flex items-center gap-1 ${notInFinal ? 'opacity-60 line-through' : ''}`}
                                title={a.action + (reason ? (reason === 'suppressed' ? ' (suppressed - wildcard/fields broadening conflict)' : ' (subtracted)') : '')}
                              >
                                <span className="truncate">{a.action}</span>
                                {reason && (
                                  <span className={`text-[9px] px-1 py-0.5 rounded border ${reason === 'suppressed' ? 'bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300/60' : 'bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-300/60'}`}
                                    title={reason === 'suppressed' ? 'Suppressed: wildcard or allProperties conflicts with removed specifics' : 'Subtracted: removed via subtract roles'}>
                                    {reason}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                  <div className="border rounded p-2">
                    <h4 className="text-xs font-semibold mb-1 flex items-center justify-between">Remove ({comboPreview.removals.length})
                      <button type="button" className="text-[10px] underline ml-2 opacity-70 hover:opacity-100" onClick={() => setRemoveFilters({ effective: true, kept: true, noEffect: true })}>reset</button>
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-1">
                      {(['effective','kept','noEffect'] as const).map(k => (
                        <label key={k} className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                          <Checkbox
                            checked={(removeFilters as any)[k]}
                            onCheckedChange={() => setRemoveFilters(f => ({ ...f, [k]: !(f as any)[k] }))}
                          />
                          <span>{k}</span>
                        </label>
                      ))}
                    </div>
                    {comboPreview.removals.length === 0 && <div className="text-xs text-muted-foreground">None</div>}
                    {comboPreview.removals.length > 0 && (
                      <ul className="max-h-48 overflow-auto text-[11px] space-y-0.5">
                        {comboPreview.removals
                          .slice()
                          .sort((a,b)=>a.action.localeCompare(b.action))
                          .map(a => {
                            const reason = comboPreview.removalReason[a.id];
                            const style = reason === 'no-effect' ? 'opacity-60' : reason === 'kept' ? 'opacity-70' : '';
                            if (reason === 'effective' && !removeFilters.effective) return null;
                            if (reason === 'kept' && !removeFilters.kept) return null;
                            if (reason === 'no-effect' && !removeFilters.noEffect) return null;
                            return (
                              <li key={a.id} className={`font-mono truncate flex items-center gap-1 ${style}`} title={a.action + (reason ? ` (${reason})` : '')}>
                                <span className="truncate">{a.action}</span>
                                {reason && (
                                  <span className={`text-[9px] px-1 py-0.5 rounded border ${reason === 'effective' ? 'bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300/60' : reason === 'kept' ? 'bg-emerald-200 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-300/60' : 'bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-300/60'}`}
                                    title={reason === 'effective' ? 'Will remove this action (present in clone set)' : reason === 'kept' ? 'Removal had partial/no effect (action still ends in final)' : 'No effect: action not present in clone set'}>
                                    {reason}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                  <div className="border rounded p-2">
                    <h4 className="text-xs font-semibold mb-1">Result ({comboPreview.final.length})</h4>
                    <div className="text-[11px] text-muted-foreground mb-1">Total after apply</div>
                    <ul className="max-h-48 overflow-auto text-[11px] space-y-0.5">
                      {comboPreview.final.slice(0,50).sort((a,b)=>a.action.localeCompare(b.action)).map(a => (
                        <li key={a.id} className="font-mono truncate" title={a.action}>{a.action}</li>
                      ))}
                      {comboPreview.final.length > 50 && <li className="text-[10px] text-muted-foreground">… {comboPreview.final.length - 50} more</li>}
                    </ul>
                  </div>
                </div>
                {/* Legend */}
                <div className="mt-4 border rounded p-2 bg-muted/30">
                  <h5 className="text-[10px] font-semibold mb-1 tracking-wide uppercase">Legend</h5>
                  <ul className="grid md:grid-cols-3 gap-2 text-[10px]">
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-300/60">subtracted</span> Added via clone but explicitly removed by subtract roles.</li>
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300/60">suppressed</span> Wildcard/allProperties blocked by specific removals.</li>
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300/60">effective</span> Removal eliminates action present in clone set.</li>
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border bg-emerald-200 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-300/60">kept</span> Removal requested but action still survives (broader context retained).</li>
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-300/60">no-effect</span> Removal targets action not in clone union.</li>
                    <li className="flex items-center gap-1"><span className="px-1 py-0.5 rounded border">(no badge)</span> Included action will appear in final.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <div className="flex gap-2 ml-auto">
              {comboPreview ? (
                <>
                  <Button variant="secondary" type="button" onClick={resetPreview}>Back</Button>
                  <Button variant="default" type="button" onClick={applyCombinationConfirmed}>Apply</Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" type="button" onClick={() => setCombinatorOpen(false)}>Cancel</Button>
                  <Button variant="default" type="button" onClick={computeCombinationPreview} disabled={cloneRoles.length === 0}>Combine</Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default RoleEditorPage;