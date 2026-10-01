"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/** Re-reads the status page's data on demand and every 15 seconds. */
export function StatusRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => start(() => router.refresh()), 15_000);
    return () => clearInterval(t);
  }, [auto, router]);

  return (
    <div className="flex items-center gap-3">
      <label className="flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[hsl(var(--accent))]" />
        Auto-refresh
      </label>
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground active:scale-[0.98]"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Refresh
      </button>
    </div>
  );
}
