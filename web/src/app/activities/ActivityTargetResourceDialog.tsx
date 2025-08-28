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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

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
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedTypeWasTyped, setSelectedTypeWasTyped] =
    useState<boolean>(false);
  const initialRef = useRef<TargetResourceDto[] | null>(null);
  const [selected, setSelected] = useState<{
    resourceType: string;
    index: number;
  } | null>(null);
  const [propNameInputs, setPropNameInputs] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    if (!open || !activity?.id || !accessToken) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          `/api/activity/${activity.id}/targetresource`,
          apiBase
        );
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load target resources");
        const json = (await res.json()) as any[];
        const mapped: TargetResourceDto[] = Array.isArray(json)
          ? json.map((r: any) => ({
              id: String(r?.id ?? r?.Id ?? r?.ID),
              resourceType: String(
                r?.resourceType ?? r?.ResourceType ?? r?.type ?? ""
              ),
              properties: Array.isArray(r?.properties ?? r?.Properties)
                ? (r?.properties ?? r?.Properties).map((p: any) => ({
                    id: String(p?.id ?? p?.Id ?? p?.ID ?? ""),
                    propertyName: String(
                      p?.propertyName ??
                        p?.PropertyName ??
                        p?.name ??
                        p?.Name ??
                        ""
                    ),
                    isSensitive: Boolean(
                      p?.isSensitive ?? p?.IsSensitive ?? false
                    ),
                    description: (p?.description ?? p?.Description ?? null) as
                      | string
                      | null,
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

  // Load known target resource types (union across all activities)
  useEffect(() => {
    if (!open || !accessToken) return;
    (async () => {
      try {
        const res = await fetch(new URL("/api/activity", apiBase), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const list: any[] = Array.isArray(json) ? json : [];
        const types = new Set<string>();
        for (const a of list) {
          const trs: any[] = (a?.targetResources ??
            a?.TargetResources ??
            []) as any[];
          trs.forEach((t) => {
            const rt = String(t?.resourceType ?? t?.ResourceType ?? "").trim();
            if (rt) types.add(rt);
          });
        }
        setKnownTypes(Array.from(types).sort((a, b) => a.localeCompare(b)));
      } catch {
        // ignore
      }
    })();
  }, [open, accessToken, apiBase]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
  }, [open, activity?.id]);

  const getPropDisplay = (p: TargetResourceProperty) => p.propertyName;

  const selectedProp = useMemo(() => {
    if (!selected) return null;
    const grp = resources.find(
      (g) => (g.resourceType ?? "") === selected.resourceType
    );
    if (!grp || !Array.isArray(grp.properties)) return null;
    return grp.properties[selected.index] ?? null;
  }, [selected, resources]);

  const setPropField = (key: string, value: any) => {
    setResources((prev) => {
      if (!selected) return prev;
      const next = structuredClone(prev);
      const grp = next.find(
        (g) => (g.resourceType ?? "") === selected.resourceType
      );
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
        const isTemp = !r.id || r.id.startsWith("temp-");
        if (isTemp) {
          // Create new target resource (global catalog). Server does not return ID.
          const createUrl = new URL(`/api/activity/target`, apiBase);
          const res = await fetch(createUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              targetResource: {
                resourceType: r.resourceType,
                properties: r.properties ?? [],
              },
            }),
          });
          if (!res.ok) {
            throw new Error(
              `Failed to create target resource ${r.resourceType}`
            );
          }
          // Note: associating the new target resource to the activity may require a server endpoint.
        } else {
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
            <CardTitle className="text-lg">
              {activity?.name ?? "Activity"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!isDirty || saving || !accessToken}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid grid-cols-3 gap-4 h-full">
                {/* Left: 1/3 width, accordion per resource type */}
                <div className="col-span-1 overflow-auto border rounded bg-muted/40 p-2 space-y-2">
                  {/* Add target resource type */}
                  <div className="flex items-center gap-2">
                    {/* Combined input + dropdown (combobox) */}
                    <div className="relative flex-1">
                      <Input
                        value={selectedType}
                        onChange={(e) => {
                          setSelectedType(e.target.value);
                          setSelectedTypeWasTyped(true);
                        }}
                        placeholder="Type or pick a resource type"
                        className="text-xs pr-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const rt = selectedType.trim();
                            if (!rt) {
                              toast.error("Type is required");
                              return;
                            }
                            // Block typed creation when it already exists globally
                            const existsGlobally = knownTypes.some(
                              (t) => t.toLowerCase() === rt.toLowerCase()
                            );
                            if (existsGlobally) {
                              toast.error(
                                "Type already exists globally. Pick it from the list."
                              );
                              return;
                            }
                            const exists = resources.some(
                              (r) =>
                                (r.resourceType ?? "").toLowerCase() ===
                                rt.toLowerCase()
                            );
                            if (exists) {
                              toast.error(
                                "Type already exists in this activity"
                              );
                              return;
                            }
                            setResources((prev) => [
                              {
                                id: `temp-${crypto.randomUUID()}`,
                                resourceType: rt,
                                properties: [],
                              },
                              ...prev,
                            ]);
                            setSelected({ resourceType: rt, index: 0 });
                            setSelectedType("");
                            setSelectedTypeWasTyped(false);
                            toast.success("Target resource added");
                          }
                        }}
                        aria-label="Resource type"
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                            aria-label="Show known types"
                            title="Show known types"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="z-[90] w-64 max-h-64 overflow-auto">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Known resource types
                          </DropdownMenuLabel>
                          <div className="p-1">
                            {knownTypes
                              .filter(
                                (t) =>
                                  !resources.some(
                                    (r) =>
                                      (r.resourceType ?? "").toLowerCase() ===
                                      t.toLowerCase()
                                  )
                              )
                              .filter((t) =>
                                selectedType.trim()
                                  ? t
                                      .toLowerCase()
                                      .includes(
                                        selectedType.trim().toLowerCase()
                                      )
                                  : true
                              ).length === 0 ? (
                              <div className="text-[11px] text-muted-foreground px-2 py-1">
                                No matching types
                              </div>
                            ) : (
                              knownTypes
                                .filter(
                                  (t) =>
                                    !resources.some(
                                      (r) =>
                                        (r.resourceType ?? "").toLowerCase() ===
                                        t.toLowerCase()
                                    )
                                )
                                .filter((t) =>
                                  selectedType.trim()
                                    ? t
                                        .toLowerCase()
                                        .includes(
                                          selectedType.trim().toLowerCase()
                                        )
                                    : true
                                )
                                .map((t) => (
                                  <DropdownMenuItem
                                    key={t}
                                    className="text-xs"
                                    onClick={() => {
                                      setSelectedType(t);
                                      setSelectedTypeWasTyped(false);
                                    }}
                                  >
                                    <span className="font-mono truncate">
                                      {t}
                                    </span>
                                  </DropdownMenuItem>
                                ))
                            )}
                          </div>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1 text-[11px] text-muted-foreground">
                            Pick a type, then click +
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      title="Add target resource"
                      aria-label="Add target resource"
                      onClick={() => {
                        const rt = selectedType.trim();
                        if (!rt) {
                          toast.error("Type is required");
                          return;
                        }
                        // If this was typed and it exists globally, block to avoid duplicates in catalog
                        if (selectedTypeWasTyped) {
                          const existsGlobally = knownTypes.some(
                            (t) => t.toLowerCase() === rt.toLowerCase()
                          );
                          if (existsGlobally) {
                            toast.error(
                              "Type already exists globally. Pick it from the list."
                            );
                            return;
                          }
                        }
                        const exists = resources.some(
                          (r) =>
                            (r.resourceType ?? "").toLowerCase() ===
                            rt.toLowerCase()
                        );
                        if (exists) {
                          toast.error("Type already exists in this activity");
                          return;
                        }
                        setResources((prev) => [
                          {
                            id: `temp-${crypto.randomUUID()}`,
                            resourceType: rt,
                            properties: [],
                          },
                          ...prev,
                        ]);
                        setSelected({ resourceType: rt, index: 0 });
                        setSelectedType("");
                        setSelectedTypeWasTyped(false);
                        toast.success("Target resource added");
                      }}
                      disabled={!selectedType}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {resources.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      No target resources
                    </div>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {resources.map((r) => {
                        const rt = r.resourceType ?? "";
                        const props = Array.isArray(r.properties)
                          ? r.properties
                          : [];
                        return (
                          <AccordionItem key={rt} value={rt}>
                            <AccordionTrigger className="px-2 text-xs">
                              {rt || "(unknown)"}
                            </AccordionTrigger>
                            <AccordionContent>
                              {/* Add new property to this resource type */}
                              <div className="flex items-center gap-2 px-2 pb-2">
                                <Input
                                  value={propNameInputs[rt] ?? ""}
                                  onChange={(e) =>
                                    setPropNameInputs((prev) => ({
                                      ...prev,
                                      [rt]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const name = (
                                        propNameInputs[rt] ?? ""
                                      ).trim();
                                      if (!name) {
                                        toast.error(
                                          "Property name is required"
                                        );
                                        return;
                                      }
                                      const dup = props.some(
                                        (p) =>
                                          (
                                            p.propertyName ?? ""
                                          ).toLowerCase() === name.toLowerCase()
                                      );
                                      if (dup) {
                                        toast.error("Property already exists");
                                        return;
                                      }
                                      setResources((prev) => {
                                        const next = structuredClone(prev);
                                        const grp = next.find(
                                          (g) => (g.resourceType ?? "") === rt
                                        );
                                        if (!grp) return prev;
                                        if (!Array.isArray(grp.properties))
                                          grp.properties = [] as any;
                                        (grp.properties as any[]).unshift({
                                          id: `prop-temp-${crypto.randomUUID()}`,
                                          propertyName: name,
                                          isSensitive: false,
                                          description: null,
                                        });
                                        return next;
                                      });
                                      setSelected({
                                        resourceType: rt,
                                        index: 0,
                                      });
                                      setPropNameInputs((prev) => ({
                                        ...prev,
                                        [rt]: "",
                                      }));
                                      toast.success("Property added");
                                    }
                                  }}
                                  placeholder="New property name"
                                  className="text-xs"
                                  aria-label={`New property name for ${rt}`}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const name = (
                                      propNameInputs[rt] ?? ""
                                    ).trim();
                                    if (!name) {
                                      toast.error("Property name is required");
                                      return;
                                    }
                                    const dup = props.some(
                                      (p) =>
                                        (p.propertyName ?? "").toLowerCase() ===
                                        name.toLowerCase()
                                    );
                                    if (dup) {
                                      toast.error("Property already exists");
                                      return;
                                    }
                                    setResources((prev) => {
                                      const next = structuredClone(prev);
                                      const grp = next.find(
                                        (g) => (g.resourceType ?? "") === rt
                                      );
                                      if (!grp) return prev;
                                      if (!Array.isArray(grp.properties))
                                        grp.properties = [] as any;
                                      (grp.properties as any[]).unshift({
                                        id: `prop-temp-${crypto.randomUUID()}`,
                                        propertyName: name,
                                        isSensitive: false,
                                        description: null,
                                      });
                                      return next;
                                    });
                                    setSelected({ resourceType: rt, index: 0 });
                                    setPropNameInputs((prev) => ({
                                      ...prev,
                                      [rt]: "",
                                    }));
                                    toast.success("Property added");
                                  }}
                                  aria-label={`Add property to ${rt}`}
                                >
                                  Add
                                </Button>
                              </div>
                              <ul className="space-y-1">
                                {props.length === 0 && (
                                  <li className="text-[11px] text-muted-foreground px-2">
                                    No properties
                                  </li>
                                )}
                                {props.map((p, i) => {
                                  const isSel =
                                    selected?.resourceType === rt &&
                                    selected.index === i;
                                  const label =
                                    getPropDisplay(p) || "(unnamed)";
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
                                        onClick={() =>
                                          setSelected({
                                            resourceType: rt,
                                            index: i,
                                          })
                                        }
                                        title={p?.description ?? undefined}
                                      >
                                        <span className="font-mono break-all">
                                          {label}
                                        </span>
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
                        <div className="text-xs text-muted-foreground">
                          Resource type
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={selected?.resourceType ?? ""}
                            readOnly
                            disabled
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                          Property name
                        </label>
                        <div className="col-span-2">
                          <Input
                            value={getPropDisplay(selectedProp)}
                            onChange={(e) =>
                              setPropField("propertyName", e.target.value)
                            }
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 items-start gap-2">
                        <label className="text-xs text-muted-foreground">
                          Description
                        </label>
                        <div className="col-span-2">
                          <textarea
                            value={(selectedProp.description ?? "") as string}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                              setPropField("description", e.target.value)
                            }
                            className="text-xs min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Describe this property (optional)"
                          />
                        </div>
                      </div>

                      {/* Render boolean fields as Switch controls */}
                      <div className="mt-4 border-t pt-3">
                        <div className="text-[11px] text-muted-foreground mb-2">
                          Flags
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 text-xs">
                            <Switch
                              checked={Boolean(selectedProp.isSensitive)}
                              onCheckedChange={(v) =>
                                setPropField("isSensitive", Boolean(v))
                              }
                            />
                            <span>Sensitive</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(null)}
                        >
                          Done
                        </Button>
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
