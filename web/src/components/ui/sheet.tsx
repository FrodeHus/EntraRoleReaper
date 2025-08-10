import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

export function Sheet({ children, open, onOpenChange }: { children: React.ReactNode, open: boolean, onOpenChange: (o: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function SheetTrigger({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
}

export function SheetContent({
  children,
  side = "right",
}: {
  children: React.ReactNode;
  side?: "right" | "left";
}) {
  const slideIn =
    side === "right" ? "slide-in-from-right" : "slide-in-from-left";
  const slideOut =
    side === "right" ? "slide-out-to-right" : "slide-out-to-left";
  const sideClass = side === "right" ? "right-0 border-l" : "left-0 border-r";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={`fixed top-0 bottom-0 z-50 ${sideClass} w-[480px] bg-card text-card-foreground border p-4 overflow-auto shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:${slideIn} data-[state=closed]:${slideOut} duration-300 ease-out`}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 py-3 border-b bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/50">
      {children}
    </div>
  );
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-lg font-semibold">{children}</div>;
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

export function SheetClose({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Close asChild>{children}</DialogPrimitive.Close>
}
