import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import React from "react";

export function ScoreSheet({
  open,
  onOpenChange,
  evaluationResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationResult: any | null;
}) {
  if (!evaluationResult) return null;
  const roleDef = evaluationResult.roleDefinition ?? {};
  const resourceActions = Array.isArray(roleDef.resourceActions) ? roleDef.resourceActions : [];
  const scoreCards = Array.isArray(evaluationResult.roleScoreCards)
    ? evaluationResult.roleScoreCards
    : [];
  const [accordionOpen, setAccordionOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>
              {roleDef.displayName ?? roleDef.name ?? "Role"}
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="font-semibold text-base">
            Role Name: {roleDef.displayName ?? roleDef.name ?? "Unknown"}
          </div>
          <div>
            <button
              type="button"
              className="text-xs underline text-blue-600 dark:text-blue-400 mb-2"
              onClick={() => setAccordionOpen((v) => !v)}
            >
              {accordionOpen ? "Hide" : "Show"} Resource Actions
            </button>
            {accordionOpen && (
              <div className="border rounded bg-muted/30 p-2 text-xs max-h-48 overflow-auto">
                {resourceActions.length === 0 ? (
                  <div className="text-muted-foreground">
                    No resource actions.
                  </div>
                ) : (
                  <ul className="list-disc pl-4">
                    {resourceActions.map((ra: any, i: number) => (
                      <li key={i}>{ra}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="text-lg font-bold">
            Total Score: {evaluationResult.totalScore ?? "N/A"}
          </div>
          {scoreCards.length === 0 ? (
            <div className="text-muted-foreground">
              No score cards available.
            </div>
          ) : (
            scoreCards.map((card: any, idx: number) => (
              <div
                key={idx}
                className="border rounded p-3 bg-card text-card-foreground"
              >
                <div className="font-semibold text-base mb-1">
                  {card.evaluatorName ?? card.name ?? `Score Card ${idx + 1}`}
                </div>
                <div className="text-sm mb-2">
                  Score:{" "}
                  <span className="font-bold">{card.score ?? "N/A"}</span>
                </div>
                {card.description && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {card.description}
                  </div>
                )}
                {/* Render any additional fields if present */}
                {Object.entries(card)
                  .filter(
                    ([key]) =>
                      !["title", "name", "score", "description"].includes(key)
                  )
                  .map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-semibold">{key}:</span>{" "}
                      {String(value)}
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
