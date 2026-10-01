"use client";

import Link from "next/link";
import { Bell, Star } from "lucide-react";
import { useAlertRules } from "@/lib/client/alert-rules";
import { useWatchlist } from "@/lib/client/watchlist";
import { cn } from "@/lib/utils";

const BASE =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground transition-all hover:border-accent/50 hover:text-foreground active:scale-95";

/** Watchlist and alerts shortcuts. The bell carries a badge for alerts that fired while you were away. */
export function HeaderActions() {
  const { items, ready } = useWatchlist();
  const { unseen } = useAlertRules();

  return (
    <>
      <Link href="/watchlist" aria-label={`Watchlist${ready && items.length ? `, ${items.length} companies` : ""}`} title="Watchlist" className={BASE}>
        <Star className="h-4 w-4" />
        {ready && items.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold text-accent-foreground">
            {items.length}
          </span>
        ) : null}
      </Link>
      <Link href="/alerts" aria-label={unseen ? `Alerts, ${unseen} triggered` : "Alerts"} title="Alerts" className={cn(BASE, unseen > 0 && "border-flat/50 text-flat")}>
        <Bell className={cn("h-4 w-4", unseen > 0 && "animate-[wiggle_0.6s_ease-in-out_2]")} />
        {unseen > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-flat px-1 font-mono text-[0.625rem] font-semibold text-background">
            {unseen}
          </span>
        ) : null}
      </Link>
    </>
  );
}
