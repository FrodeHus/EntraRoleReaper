import * as React from "react"
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemActions,
  ItemMedia,
} from "@/components/ui/item"
import { cn } from "@/lib/utils"

export type ResourceActionPillProps = {
  /** A resource action formatted as "namespace/entity/propertySet/action" */
  action: string
  className?: string
  size?: "default" | "sm"
  showIcon?: boolean
  compact?: boolean
}

function parseResourceAction(value: string) {
  const parts = (value || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)

  const namespace = parts[0] ?? ""
  const entity = parts[1] ?? (parts[0] ?? value)
  let propertySet = "";
  let actionName = "";

  if (parts.length >= 4) {
    // namespace/entity/propertySet/action
    propertySet = parts[2] ?? "";
    actionName = parts[3] ?? "";
  } else if (parts.length === 3) {
    // namespace/entity/action (no property set)
    actionName = parts[2] ?? "";
  } else if (parts.length === 2) {
    // namespace/entity (best-effort)
    actionName = parts[1] ?? "";
  } else {
    actionName = value;
  }

  return { namespace, entity, propertySet, actionName }
}

export function ResourceActionPill({ action, className, size = "sm", showIcon = false, compact = false }: ResourceActionPillProps) {
  const { namespace, entity, propertySet, actionName } = React.useMemo(
    () => parseResourceAction(action),
    [action]
  )

  const content = React.useMemo(() => {
    const bits = [propertySet, actionName].filter(Boolean)
    return bits.join(" • ") || action
  }, [propertySet, actionName, action])

  if (compact) {
    return (
      <Item
        data-component="resource-action-pill"
        variant="outline"
        size={size}
        title={action}
        className={cn("items-center gap-2", className)}
      >
        {showIcon && (
          <ItemMedia variant="icon" aria-hidden>
            <div className="size-3 rounded-sm bg-accent" />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemHeader>
            <ItemTitle>
              <span className="truncate">{actionName || action}</span>
            </ItemTitle>
            <ItemActions />
          </ItemHeader>
          <ItemFooter>
            <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
              <span className="truncate">
                {(namespace || entity) && (
                  <>
                    <span className="px-1 rounded bg-muted border mr-1">
                      {(namespace && entity) ? `${namespace}/${entity}` : (entity || namespace)}
                    </span>
                  </>
                )}
              </span>
              <span className="truncate">
                {propertySet && (
                  <span className="px-1 rounded bg-muted border ml-1">{propertySet}</span>
                )}
              </span>
            </div>
          </ItemFooter>
        </ItemContent>
      </Item>
    )
  }

  return (
    <Item
      data-component="resource-action-pill"
      variant="outline"
      size={size}
      title={action}
      className={cn("items-center gap-3", className)}
    >
      {showIcon && (
        <ItemMedia variant="icon" aria-hidden>
          <div className="size-4 rounded-sm bg-accent" />
        </ItemMedia>
      )}
      <ItemContent>
        <ItemHeader>
          <ItemTitle>
            <span className="truncate">{entity || action}</span>
          </ItemTitle>
          <ItemActions />
        </ItemHeader>
        <ItemDescription>
          <span className="truncate">{content}</span>
        </ItemDescription>
        {namespace && (
          <ItemFooter>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded border bg-muted">{namespace}</span>
            </span>
          </ItemFooter>
        )}
      </ItemContent>
    </Item>
  )
}

export default ResourceActionPill
