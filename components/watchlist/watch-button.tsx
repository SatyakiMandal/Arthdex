"use client";

import { Star } from "lucide-react";
import { useWatchlist, type WatchKind } from "@/lib/client/watchlist";
import { cn } from "@/lib/utils";

/** Star toggle that adds or removes a company from the local watchlist. */
export function WatchButton({
  kind,
  id,
  name,
  className,
}: {
  kind: WatchKind;
  id: string;
  name: string;
  className?: string;
}) {
  const { has, toggle, ready } = useWatchlist();
  const on = ready && has(kind, id);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      title={on ? "On your watchlist" : "Add to watchlist"}
      onClick={() => toggle(kind, id, name)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all active:scale-95",
        on
          ? "border-flat/50 bg-flat/10 text-flat"
          : "border-border bg-surface-muted text-muted-foreground hover:border-accent/50 hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-3.5 w-3.5 transition-transform", on && "scale-110 fill-current")} />
      {on ? "Watching" : "Watch"}
    </button>
  );
}
