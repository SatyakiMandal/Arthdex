import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ApiNewsItem } from "@/lib/api/types";

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

/**
 * The newest filings and coverage as a compact two-column list: time and source on one
 * line, the headline on the next, tickers linked. The full feed, with filters, is /news.
 */
export function LatestFilings({ items }: { items: ApiNewsItem[] }) {
  return (
    <ul className="grid gap-x-10 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border/70 py-3">
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{when(item.publishedAt)}</span>
            <span aria-hidden>·</span>
            <span>{item.kind === "filing" ? "Exchange filing" : item.source}</span>
            {item.symbols.slice(0, 3).map((s) => (
              <Link key={s} href={`/company/${s}`} className="font-mono text-foreground underline decoration-border underline-offset-4 hover:decoration-gold">
                {s}
              </Link>
            ))}
          </p>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group mt-1 flex items-start gap-1 text-[15px] leading-snug hover:underline hover:decoration-gold hover:underline-offset-4">
              <span className="line-clamp-2">{item.headline}</span>
              <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </a>
          ) : (
            <p className="mt-1 line-clamp-2 text-[15px] leading-snug">{item.headline}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
