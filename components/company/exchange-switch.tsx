"use client";

import { useOptimistic, useTransition } from "react";
import { setExchangeView } from "@/app/actions/exchange";
import type { ExchangeView } from "@/lib/exchange-view";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ExchangeView; label: string; title: string }[] = [
  { id: "NSE", label: "NSE", title: "Show prices from the National Stock Exchange" },
  { id: "BSE", label: "BSE", title: "Show prices from BSE" },
  { id: "BOTH", label: "Compare", title: "Show NSE and BSE side by side" },
];

/** NSE, BSE or both, for a company listed on both exchanges. The choice applies site-wide. */
export function ExchangeSwitch({ view }: { view: ExchangeView }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(view);

  return (
    <div role="radiogroup" aria-label="Exchange" className={cn("inline-flex border border-border/70", pending && "opacity-70")}>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={shown === o.id}
          title={o.title}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setShown(o.id);
              await setExchangeView(o.id);
            })
          }
          className={cn(
            "px-2 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wider transition-colors",
            shown === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
