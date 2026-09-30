import Link from "next/link";
import { ExternalLink, FileText, Newspaper } from "lucide-react";
import type { ApiNewsItem } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";

/**
 * Flag styling encodes *what kind of disclosure* an item is, not whether the
 * news is good. A stake sale and an order win are both material; colour helps a
 * reader scan for the category they care about rather than telling them what to
 * conclude.
 */
const FLAG_META: Record<string, { label: string; className: string }> = {
  "lodr-disclosure": { label: "LODR", className: "border-accent/40 bg-accent/10 text-accent" },
  "order-win": { label: "Order win", className: "border-up/40 bg-up/10 text-up" },
  "rating-action": { label: "Rating", className: "border-border bg-surface-muted text-muted-foreground" },
  earnings: { label: "Earnings", className: "border-border bg-surface-muted text-foreground" },
  "board-outcome": { label: "Board", className: "border-border bg-surface-muted text-foreground" },
  "management-change": { label: "Management", className: "border-flat/40 bg-flat/10 text-flat" },
  "insider-window": { label: "Trading window", className: "border-border bg-surface-muted text-muted-foreground" },
  governance: { label: "Governance", className: "border-border bg-surface-muted text-muted-foreground" },
  "stake-sale": { label: "Stake sale", className: "border-flat/40 bg-flat/10 text-flat" },
  acquisition: { label: "Acquisition", className: "border-accent/40 bg-accent/10 text-accent" },
  "fund-raising": { label: "Fund raising", className: "border-accent/40 bg-accent/10 text-accent" },
  dividend: { label: "Dividend", className: "border-up/40 bg-up/10 text-up" },
  "capital-return": { label: "Capital return", className: "border-up/40 bg-up/10 text-up" },
  "investor-meet": { label: "Investor meet", className: "border-border bg-surface-muted text-muted-foreground" },
  "material-event": { label: "Material event", className: "border-flat/40 bg-flat/10 text-flat" },
  ipo: { label: "IPO", className: "border-accent/40 bg-accent/10 text-accent" },
  macro: { label: "Macro", className: "border-border bg-surface-muted text-muted-foreground" },
};

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function NewsFeed({
  items,
  title = "Filings & Coverage",
  subtitle = "Exchange disclosures and financial press",
}: {
  items: ApiNewsItem[];
  title?: string;
  subtitle?: string;
}) {
  if (items.length === 0) {
    return (
      <DataCard title={title} subtitle={subtitle} icon={Newspaper}>
        <p className="px-4 py-8 text-sm text-muted-foreground">
          No filings or coverage in the current window.
        </p>
      </DataCard>
    );
  }

  return (
    <DataCard
      title={title}
      subtitle={subtitle}
      icon={Newspaper}
      badge={
        <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          {items.length} items
        </span>
      }
      footnote="A filing is a primary-source disclosure made to the exchange under SEBI LODR. A press item is commentary. They are tagged separately because they do not carry the same weight."
    >
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3 transition-colors hover:bg-surface-muted">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide",
                  item.kind === "filing"
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-surface-muted text-muted-foreground",
                )}
              >
                {item.kind === "filing" ? <FileText className="h-2.5 w-2.5" /> : null}
                {item.kind === "filing" ? "Filing" : "Press"}
              </span>
              <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {formatStamp(item.publishedAt)}
              </span>
              <span className="text-2xs text-muted-foreground">· {item.source}</span>

              {item.flags
                .filter((flag) => flag !== "lodr-disclosure" || item.kind !== "filing")
                .map((flag) => {
                  const meta = FLAG_META[flag];
                  if (!meta) return null;
                  return (
                    <span
                      key={flag}
                      className={cn(
                        "rounded border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                  );
                })}
            </div>

            <h4 className="mt-1.5 text-pretty text-sm font-medium">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1 hover:text-accent"
                >
                  {item.headline}
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
                </a>
              ) : (
                item.headline
              )}
            </h4>

            {item.summary ? (
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{item.summary}</p>
            ) : null}

            {item.symbols.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.symbols.map((symbol) => (
                  <Link
                    key={symbol}
                    href={`/company/${symbol}`}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {symbol}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </DataCard>
  );
}
