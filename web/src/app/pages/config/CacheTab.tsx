import { Button } from "../../../components/ui/button";
import { CacheStatusChip } from "../../CacheStatusChip";

export function CacheTab({ accessToken, onRefresh, apiBase }: { accessToken: string | null; onRefresh: () => void; apiBase: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <CacheStatusChip accessToken={accessToken} apiBase={apiBase} />
        <Button size="sm" variant="secondary" disabled={!accessToken} onClick={onRefresh}>
          Refresh cache now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground max-w-md">
        The role cache is periodically refreshed; trigger a manual refresh if you recently adjusted directory role definitions.
      </p>
    </div>
  );
}
