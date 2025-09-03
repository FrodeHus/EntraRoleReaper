import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ExternalLink, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";

interface AccessBadgeProps {
  accessToken: string | null;
  apiBase: string;
}

type SimpleRole = { id: string; name: string; isPrivileged: boolean };

type AccessVerificationResponse = {
  hasAccess: boolean;
  userDisplayName: string;
  activeRoles: SimpleRole[];
  eligibleRoles: SimpleRole[];
  requiredRoleNames: string[];
  missingRoleNames: string[];
};

export function AccessBadge({ accessToken, apiBase }: AccessBadgeProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccessVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    variant?: "default" | "destructive";
  } | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setData(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/api/onboarding/access`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBase]);

  const hasAccess = data?.hasAccess === true;
  const badgeClass = hasAccess
    ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700"
    : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700";

  async function activateRole(roleId: string) {
    if (!accessToken) return;
    try {
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
        setToast({
          msg: text || `Activation failed (${res.status})`,
          variant: "destructive",
        });
      } else {
        setToast({ msg: text || "Activation requested" });
      }
      // Auto-hide after a few seconds
      setTimeout(() => setToast(null), 4000);
    } catch (e: any) {
      setToast({
        msg: e.message || "Activation error",
        variant: "destructive",
      });
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!data && loading}
        className={`inline-flex items-center gap-1.5 h-7 px-2 rounded border text-xs font-medium ${badgeClass}`}
      >
        {hasAccess ? (
          <ShieldCheck className="h-3.5 w-3.5" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5" />
        )}
        {loading ? "Checking…" : ""}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          {/* toast */}
          {toast && (
            <div className="mb-2">
              <Alert
                className={
                  toast.variant === "destructive"
                    ? "border-destructive/50 text-destructive"
                    : undefined
                }
              >
                <AlertDescription>{toast.msg}</AlertDescription>
              </Alert>
            </div>
          )}
          {/* existing header follows */}
          <DialogHeader>
            <DialogTitle>Access verification</DialogTitle>
            <DialogDescription>
              {error ? (
                <span className="text-rose-600">{error}</span>
              ) : (
                <span>
                  Current user: <strong>{data?.userDisplayName || "-"}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {!error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active roles</CardTitle>
                  <CardDescription>
                    Permanent assignments and currently activated PIM roles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="max-h-60 overflow-auto border rounded divide-y">
                    {(data?.activeRoles || []).map((r) => (
                      <li
                        key={r.id}
                        className="px-3 py-2 text-sm flex items-center justify-between"
                      >
                        <span>{r.name}</span>
                        {r.isPrivileged && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700">
                            privileged
                          </span>
                        )}
                      </li>
                    ))}
                    {data && data.activeRoles.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        No active roles
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Eligible roles</CardTitle>
                  <CardDescription>
                    Roles you can activate via PIM when needed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="max-h-60 overflow-auto border rounded divide-y">
                    {(data?.eligibleRoles || []).map((r) => (
                      <li
                        key={r.id}
                        className="px-3 py-2 text-sm flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.isPrivileged && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700">
                              privileged
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => activateRole(r.id)}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent/40"
                          title="Activate via PIM"
                          aria-label="Activate via PIM"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    {data && data.eligibleRoles.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        No eligible roles
                      </li>
                    )}
                  </ul>
                  <div className="mt-3 text-xs">
                    <a
                      href="https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/aadmigratedroles"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 underline text-blue-600 hover:text-blue-700"
                    >
                      Manage in Entra Privileged Identity Management
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
