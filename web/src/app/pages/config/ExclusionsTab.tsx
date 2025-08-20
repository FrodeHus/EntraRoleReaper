import { Button } from "../../../components/ui/button";

export function ExclusionsTab({
  accessToken,
  items,
  loading,
  onExport,
  onImport,
  onRemove,
}: {
  accessToken: string | null;
  items: Array<{ name: string }>;
  loading: boolean;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onRemove: (name: string) => void;
}) {
  return (
    <div className="space-y-3 text-sm max-w-md">
      <p className="text-xs text-muted-foreground">Activities in this list are excluded from review output.</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" disabled={!accessToken} onClick={onExport}>
          Export
        </Button>
        <div>
          <label className="text-[10px] block font-medium mb-0.5">Import</label>
          <input
            type="file"
            className="text-[10px]"
            accept="application/json,.json"
            disabled={!accessToken}
            aria-label="Import exclusion list JSON file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onImport(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      <div className="border rounded bg-card text-card-foreground divide-y">
        {loading && <div className="p-2 text-xs text-muted-foreground">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-2 text-xs text-muted-foreground">No exclusions.</div>
        )}
        {!loading && items.length > 0 && (
          <ul>
            {items.map((e) => (
              <li key={e.name} className="flex items-center gap-2 p-2 text-xs">
                <span className="font-mono break-all flex-1">{e.name}</span>
                <button
                  onClick={() => onRemove(e.name)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="Remove exclusion"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
