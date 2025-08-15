import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Users, Plus, X, ChevronRight, ChevronDown } from "lucide-react";
import { SearchUsers, type DirectoryItem } from "../SearchUsers";
import { ReviewPanel } from "../ReviewPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";

interface ReviewPageProps {
  accessToken: string | null;
  tenantDomain: string;
}

export function ReviewPage({ accessToken, tenantDomain }: ReviewPageProps) {
  const [selected, setSelected] = useState<DirectoryItem[]>([]);
  const [openSearch, setOpenSearch] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);

  // Restore previously selected users/groups from localStorage
  useEffect(() => {
    try {
      const key = tenantDomain
        ? `er.${tenantDomain}.selectedSubjects`
        : `er.selectedSubjects`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        // Basic validation of shape
        const valid = arr.filter(
          (x: any) =>
            x &&
            typeof x.id === "string" &&
            typeof x.displayName === "string" &&
            (x.type === "user" || x.type === "group")
        );
        if (valid.length) setSelected(valid as DirectoryItem[]);
      }
    } catch {}
  }, [tenantDomain]);

  // Persist selection on change
  useEffect(() => {
    try {
      const key = tenantDomain
        ? `er.${tenantDomain}.selectedSubjects`
        : `er.selectedSubjects`;
      if (selected.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(selected));
    } catch {}
  }, [selected, tenantDomain]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Subjects card (collapsible) */}
        <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b">
            <button
              type="button"
              className="flex items-center gap-2 hover:opacity-90"
              onClick={() => setSubjectsOpen((o) => !o)}
            >
              {subjectsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium tracking-wide">Subjects</h2>
              {selected.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-secondary text-secondary-foreground text-xs px-2 py-0.5">
                  {selected.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <Button
                  variant="link"
                  className="text-sm"
                  onClick={() => setSelected([])}
                  aria-label="Clear selected users and groups"
                >
                  Clear
                </Button>
              )}
              <Button onClick={() => setOpenSearch(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add users or groups
              </Button>
            </div>
          </div>
          {subjectsOpen && (
            <div className="p-4 sm:p-5 max-h-[50vh] overflow-y-auto">
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subjects selected. Use “Add users or groups” to begin.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-2">Display name</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 sr-only">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.map((s) => (
                        <tr key={`${s.type}:${s.id}`} className="border-t">
                          <td className="p-2">{s.displayName}</td>
                          <td className="p-2 capitalize">{s.type}</td>
                          <td className="p-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <Sheet open={openSearch} onOpenChange={setOpenSearch}>
        <SheetContent side="right">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Select user(s) or group(s)</SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setOpenSearch(false)}
                aria-label="Close"
                title="Close"
              >
                Close
              </Button>
            </div>
          </SheetHeader>
          <div className="mt-3">
            <SearchUsers
              accessToken={accessToken}
              selected={selected}
              onChange={setSelected}
            />
          </div>
        </SheetContent>
      </Sheet>
      {/* Review card */}
      <section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <ReviewPanel
            accessToken={accessToken}
            selectedIds={selected
              .filter((s) => s.type === "user" || s.type === "group")
              .map((s) => `${s.type}:${s.id}`)}
          />
        </div>
      </section>
    </>
  );
}
