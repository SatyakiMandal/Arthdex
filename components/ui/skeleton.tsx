import { cn } from "@/lib/utils";

/** Pulsing placeholder used while a server component streams in. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,hsl(var(--muted))_25%,hsl(var(--surface-raised))_50%,hsl(var(--muted))_75%)] bg-[length:200%_100%]", className)} />;
}

/** Panel-shaped placeholder matching the DataCard footprint. */
export function PanelSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Page-level shell shown while a route's data resolves. */
export function PageSkeleton({ panels = 2 }: { panels?: number }) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-9 w-80" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        {Array.from({ length: panels }).map((_, index) => (
          <PanelSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
