import { useEffect, useRef, useState, useMemo } from "react";
import { LogOut, Play, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "./popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "./command";
import { toast } from "sonner";

export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

interface UserMenuProps {
  reviewerName: string;
  tenantDomain: string;
  onLogout: () => void;
  authed?: boolean;
  accessToken?: string | null;
  apiBase?: string;
}

export function UserMenu({
  reviewerName,
  tenantDomain,
  onLogout,
  authed,
  accessToken,
  apiBase,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [eligibleRoles, setEligibleRoles] = useState<
    Array<{
      id: string;
      name: string;
      isPrivileged?: boolean;
      isActive?: boolean;
    }>
  >([]);
  const [activateBusy, setActivateBusy] = useState<Record<string, boolean>>({});
  const canUsePim = !!authed && !!accessToken && !!apiBase;

  // Fetch eligible roles on first submenu open
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!submenuOpen || !canUsePim) return;
      if (eligibleRoles.length > 0) return; // already loaded
      setLoadingEligible(true);
      try {
        const res = await fetch(`${apiBase}/api/onboarding/access`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          const elig = Array.isArray(json?.eligibleRoles)
            ? json.eligibleRoles
            : [];
          const active = new Set(
            (Array.isArray(json?.activeRoles) ? json.activeRoles : []).map(
              (r: any) => String(r.id)
            )
          );
          setEligibleRoles(
            elig.map((r: any) => ({
              id: String(r.id),
              name: String(r.name),
              isPrivileged: Boolean(r.isPrivileged),
              isActive: active.has(String(r.id)),
            }))
          );
        }
      } finally {
        if (!cancelled) setLoadingEligible(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [submenuOpen, canUsePim, apiBase, accessToken, eligibleRoles.length]);

  async function activateRole(roleId: string) {
    if (!canUsePim) return;
    try {
      setActivateBusy((s) => ({ ...s, [roleId]: true }));
      const res = await fetch(`${apiBase}/api/entra/activate-pim-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roleId, durationHours: 1 }),
      });
      const text = await res.text();
      if (!res.ok) {
        toast.error(text || `Activation failed (${res.status})`);
      } else {
        toast.success(text || "Activation requested");
      }
    } catch {
      toast.error("Activation error");
    } finally {
      setActivateBusy((s) => ({ ...s, [roleId]: false }));
    }
  }

  const initialsText = useMemo(() => initials(reviewerName), [reviewerName]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          className="h-8 w-8 rounded-full bg-accent/40 text-foreground inline-flex items-center justify-center font-medium"
          title={reviewerName || "User"}
        >
          {initialsText}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <div className="px-3 py-3 text-xs">
            <div className="text-foreground/80">Reviewer</div>
            <div
              className="truncate text-foreground text-sm"
              title={reviewerName}
            >
              {reviewerName || "-"}
            </div>
            <div className="mt-2 text-foreground/80">Domain</div>
            <div
              className="truncate text-foreground text-sm"
              title={tenantDomain}
            >
              {tenantDomain || "-"}
            </div>
          </div>
          <CommandSeparator />
          <CommandList>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={onLogout as any}
                className="cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </CommandItem>
            </CommandGroup>
            {canUsePim && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Eligible PIM Roles
                  </div>
                  {/* Submenu trigger */}
                  <Popover open={submenuOpen} onOpenChange={setSubmenuOpen}>
                    <PopoverAnchor asChild>
                      <div>
                        <CommandItem
                          onSelect={() => setSubmenuOpen((v) => !v)}
                          className="cursor-pointer justify-between"
                        >
                          <span>Eligible PIM Roles</span>
                          <ChevronRight className="h-4 w-4 opacity-60" />
                        </CommandItem>
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-80 p-0"
                    >
                      <Command>
                        <CommandInput placeholder="Filter roles…" />
                        <CommandList>
                          {loadingEligible && (
                            <CommandEmpty>Loading…</CommandEmpty>
                          )}
                          {!loadingEligible && eligibleRoles.length === 0 && (
                            <CommandEmpty>No eligible roles</CommandEmpty>
                          )}
                          <CommandGroup>
                            {eligibleRoles.map((r) => (
                              <CommandItem
                                key={r.id}
                                className="justify-between"
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="truncate">{r.name}</span>
                                  {r.isPrivileged && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700">
                                      privileged
                                    </span>
                                  )}
                                  {r.isActive && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700">
                                      active
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void activateRole(r.id);
                                  }}
                                  disabled={
                                    !!activateBusy[r.id] || !!r.isActive
                                  }
                                  title={
                                    r.isActive
                                      ? "Already active"
                                      : "Activate via PIM"
                                  }
                                  aria-label={
                                    r.isActive
                                      ? "Already active"
                                      : "Activate via PIM"
                                  }
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
