import { PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the company shell resolves. The quant tab in particular fits four
 * volatility models on a cold cache, which takes several seconds — a blank page
 * for that long reads as a failure.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
      <div className="rounded-xl border border-border bg-surface p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-4 h-[320px] w-full" />
      </div>
      <PanelSkeleton rows={6} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
      </div>
    </div>
  );
}
