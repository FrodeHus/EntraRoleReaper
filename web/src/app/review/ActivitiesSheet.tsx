import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";

export function ActivitiesSheet({
  open,
  onOpenChange,
  review,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: any | null;
}) {
  const items: any[] = Array.isArray((review as any)?.activityResults)
    ? (review as any).activityResults
    : Array.isArray((review as any)?.activityReviewResults)
    ? (review as any).activityReviewResults
    : Array.isArray((review as any)?.operations)
    ? (review as any).operations
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {review && (
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>
              Activities for {review.user?.displayName ?? review.user?.id ?? "User"}
            </SheetTitle>
          </SheetHeader>
          <div className="p-2 space-y-3">
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">No activities in period.</div>
            )}
            {items.map((it: any, idx: number) => {
              const act = it.activity ?? it;
              const title =
                (typeof act === "string" ? act : (act?.activityName ?? act?.activity ?? act?.name)) ??
                "(activity)";
              const category = (typeof act === "object" && act) ? (act.category ?? act.type) : undefined;
              const service = (typeof act === "object" && act) ? act.service : undefined;
              const targets: any[] =
                (typeof act === "object" && act && Array.isArray(act.targetResources))
                  ? act.targetResources
                  : Array.isArray(it.targets)
                  ? it.targets
                  : [];
              const resourceActions: any[] =
                (typeof act === "object" && act && Array.isArray(act.resourceActions))
                  ? act.resourceActions
                  : Array.isArray(it.resourceActions)
                  ? it.resourceActions
                  : [];
              return (
                <Card key={idx} className="text-sm">
                  <CardHeader>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {category && (
                        <div>
                          <span className="font-medium text-foreground">Category:</span> {category}
                        </div>
                      )}
                      {service && (
                        <div>
                          <span className="font-medium text-foreground">Service:</span> {service}
                        </div>
                      )}
                    </div>
                    {targets.length > 0 && (
                      <details className="rounded border bg-muted/20">
                        <summary className="cursor-pointer select-none px-3 py-2 font-medium list-none">
                          Targets <span className="text-xs text-muted-foreground">({targets.length})</span>
                        </summary>
                        <div className="px-4 pb-3 pt-1">
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {targets.map((t: any, i: number) => (
                              <li key={i} className="break-words">
                                {t?.displayName ?? t?.id ?? String(t)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                    {resourceActions.length > 0 && (
                      <details className="rounded border bg-muted/20">
                        <summary className="cursor-pointer select-none px-3 py-2 font-medium list-none">
                          Resource actions <span className="text-xs text-muted-foreground">({resourceActions.length})</span>
                        </summary>
                        <div className="px-4 pb-3 pt-1">
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {resourceActions.map((ra: any, i: number) => (
                              <li key={i} className="font-mono text-xs break-all">
                                {typeof ra === "string" ? ra : ra?.name ?? JSON.stringify(ra)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
