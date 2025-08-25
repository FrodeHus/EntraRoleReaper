import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// Flexible shapes to accommodate server DTOs
export type ActivitySummary = {
  id: string; // guid
  name: string;
};

type TargetResourceProperty = {
  id: string; // Guid
  propertyName: string;
  isSensitive: boolean;
  description?: string | null;
};

type TargetResourceDto = {
  id: string; // Guid
  resourceType: string;
  properties: TargetResourceProperty[];
};

export function ActivityTargetResourceDialog({
  open,
  onOpenChange,
  activity,
  accessToken,
  apiBase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivitySummary;
  accessToken: string | null;
  apiBase: string;
}) {
  const [resources, setResources] = useState<TargetResourceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initialRef = useRef<TargetResourceDto[] | null>(null);
  const [selected, setSelected] = useState<{
    resourceType: string;
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !activity?.id || !accessToken) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`/api/activity/${activity.id}/targetresource`, apiBase);
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load target resources");
        const json = (await res.json()) as any[];
  const mapped: TargetResourceDto[] = Array.isArray(json)
          ? json.map((r: any) => ({
              id: String(r?.id ?? r?.Id ?? r?.ID),
              resourceType: String(r?.resourceType ?? r?.ResourceType ?? r?.type ?? ""),
              properties: Array.isArray(r?.properties ?? r?.Properties)
                ? (r?.properties ?? r?.Properties).map((p: any) => ({
                    id: String(p?.id ?? p?.Id ?? p?.ID ?? ""),
                    propertyName: String(p?.propertyName ?? p?.PropertyName ?? p?.name ?? p?.Name ?? ""),
                    isSensitive: Boolean(p?.isSensitive ?? p?.IsSensitive ?? false),
                    description: (p?.description ?? p?.Description ?? null) as string | null,
                  }))
                : [],
            }))
          : [];
        setResources(mapped);
  initialRef.current = mapped;
      } catch (e: any) {
        setError(e?.message || "Failed to load");
        setResources([]);
  initialRef.current = [];
      } finally {
        setLoading(false);
      }
    })();
  }, [open, activity?.id, accessToken, apiBase]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
  }, [open, activity?.id]);

  const getPropDisplay = (p: TargetResourceProperty) => p.propertyName;

  const selectedProp = useMemo(() => {
    if (!selected) return null;
    const grp = resources.find((g) => (g.resourceType ?? "") === selected.resourceType);
    if (!grp || !Array.isArray(grp.properties)) return null;
    return grp.properties[selected.index] ?? null;
  }, [selected, resources]);

  const setPropField = (key: string, value: any) => {
    setResources((prev) => {
      if (!selected) return prev;
      const next = structuredClone(prev);
      const grp = next.find((g) => (g.resourceType ?? "") === selected.resourceType);
      if (!grp || !Array.isArray(grp.properties)) return prev;
      if (!grp.properties[selected.index]) return prev;
      (grp.properties[selected.index] as any)[key] = value;
      return next;
    });
  };

  const isDirty = useMemo(() => {
    const initial = initialRef.current;
    if (!initial) return false;
    try {
      return JSON.stringify(initial) !== JSON.stringify(resources);
    } catch {
      return true;
    }
  }, [resources]);

  const onSave = async () => {
    if (!accessToken || !activity?.id) return;
    setSaving(true);
    setError(null);
    try {
      // Save only changed resources if possible; otherwise save all
      const initial = initialRef.current ?? [];
      const changed = resources.filter((r) => {
        const before = initial.find((x) => x.id === r.id);
        return !before || JSON.stringify(before) !== JSON.stringify(r);
      });

      for (const r of changed) {
        const url = new URL(`/api/activity/target/${r.id}`, apiBase);
        const body = { targetResource: r } as any;
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`Failed to save target resource ${r.resourceType}`);
        }
      }

      initialRef.current = structuredClone(resources);
      // Inform other views that mappings/resources may have changed
      window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-[960px] h-[72vh] p-0">
        <Card className="w-full h-full flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{activity?.name ?? "Activity"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Close
              </Button>
              <Button size="sm" onClick={onSave} disabled={!isDirty || saving || !accessToken}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {error && (
              <div className="text-xs text-red-600 mb-2">{error}</div>
            )}
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid grid-cols-3 gap-4 h-full">
                {/* Left: 1/3 width, accordion per resource type */}
                <div className="col-span-1 overflow-auto border rounded bg-muted/40 p-2">
                  {resources.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No target resources</div>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {resources.map((r) => {
                        const rt = r.resourceType ?? "";
                        const props = Array.isArray(r.properties) ? r.properties : [];
                        return (
                          <AccordionItem key={rt} value={rt}>
                            <AccordionTrigger className="px-2 text-xs">{rt || "(unknown)"}</AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-1">
                                {props.length === 0 && (
                                  <li className="text-[11px] text-muted-foreground px-2">No properties</li>
                                )}
                                {props.map((p, i) => {
                                  const isSel = selected?.resourceType === rt && selected.index === i;
                                  const label = getPropDisplay(p) || "(unnamed)";
                                  return (
                                    <li key={`${rt}:${i}`}>
                                      <button
                                        type="button"
                                        className={
                                          "w-full text-left rounded px-2 py-1 text-xs border " +
                                          (isSel
                                            ? "bg-background border-primary/50"
                                            : "bg-card hover:bg-muted/60 border-transparent")
                                        }
                                        onClick={() => setSelected({ resourceType: rt, index: i })}
                                        title={p?.description ?? undefined}
                                      >
                                        <span className="font-mono break-all">{label}</span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>

                {/* Right: 2/3 width, details form with switches for booleans */}
                <div className="col-span-2 overflow-auto">
                  {!selectedProp ? (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                      Select a property to view details
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 items-center gap-2">
                        <div className="text-xs text-muted-foreground">Resource type</div>
                        <div className="col-span-2">
                          <Input value={selected?.resourceType ?? ""} readOnly disabled className="text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 items-center gap-2">
            <label className="text-xs text-muted-foreground">Property name</label>
                        <div className="col-span-2">
                          <Input
                            value={getPropDisplay(selectedProp)}
              onChange={(e) => setPropField("propertyName", e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 items-start gap-2">
                        <label className="text-xs text-muted-foreground">Description</label>
                        <div className="col-span-2">
                          <textarea
                            value={(selectedProp.description ?? "") as string}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPropField("description", e.target.value)}
                            className="text-xs min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Describe this property (optional)"
                          />
                        </div>
                      </div>

                      {/* Render boolean fields as Switch controls */}
                      <div className="mt-4 border-t pt-3">
                        <div className="text-[11px] text-muted-foreground mb-2">Flags</div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={Boolean(selectedProp.isSensitive)}
                              onCheckedChange={(v) => setPropField("isSensitive", Boolean(v))}
                            />
                            <span>Sensitive</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Done</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityTargetResourceDialog;
