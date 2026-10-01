import { BarChart3, LineChart, Newspaper } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { ListedDossier } from "@/components/analyzer/dossier";
import { Stat, StatGrid, inr, pct } from "@/components/analyzer/dossier/shared";
import { cn, deltaColor } from "@/lib/utils";
import type { ListedSummary, UnlistedSummary } from "@/types/analyzer";

export function ListedSummaryView({ s }: { s: ListedSummary }) {
  // A data service started before the dossier sections existed returns no detail block
  if (!s.detail) {
    return (
      <p role="alert" className="rounded-xl border border-flat/40 bg-flat/10 px-4 py-3 text-sm">
        This result is missing the dossier sections. Restart the data service (backend) so it serves the
        current summary format, then reload.
      </p>
    );
  }
  return <ListedDossier s={s} />;
}

export function UnlistedSummaryView({ s }: { s: UnlistedSummary }) {
  const p = s.price;
  return (
    <div className="space-y-4">
      <DataCard
        title="Dealer-price trajectory"
        subtitle={p.firstDate && p.lastDate ? `${p.firstDate} → ${p.lastDate} · ${p.observations} quotes` : undefined}
        icon={LineChart}
        footnote="Unlisted prices are private dealer quotes, not exchange prints. Price gaps are attributed to headlines by timing only."
      >
        <StatGrid>
          <Stat label="First quote" value={inr(p.first)} />
          <Stat label="Latest quote" value={inr(p.last)} />
          <Stat label="Change" value={pct(p.changePct)} tone={p.changePct != null ? deltaColor(p.changePct) : undefined} />
          <Stat label="High" value={inr(p.high)} />
          <Stat label="Low" value={inr(p.low)} />
          <Stat label="Price revisions" value={s.moveCount} />
        </StatGrid>
      </DataCard>

      <DataCard
        title="Largest price moves"
        subtitle="With the headlines published between the two quotes"
        icon={Newspaper}
      >
        {s.moves.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No price revisions in this window.</p>
        ) : (
          <ul className="divide-y divide-border">
            {s.moves.map((m, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm">
                    {m.from} → {m.to}
                  </p>
                  <p className={cn("font-mono text-sm", deltaColor(m.changePct))}>
                    {inr(m.startPrice)} → {inr(m.endPrice)} ({pct(m.changePct)})
                  </p>
                </div>
                {m.headlines.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {m.headlines.map((h, j) => (
                      <li key={j} className="text-2xs text-muted-foreground">
                        <span className="font-mono uppercase">{h.source}</span>{" "}
                        {h.url ? (
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                            {h.headline}
                          </a>
                        ) : (
                          h.headline
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-2xs text-muted-foreground">No matching headlines found.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard title="News coverage" subtitle={`${s.news.items ?? 0} unique articles after de-duplication`} icon={BarChart3}>
        <StatGrid>
          {Object.entries(s.news.perSource).map(([src, n]) => (
            <Stat key={src} label={src.replace(/_/g, " ")} value={n} />
          ))}
          {Object.keys(s.news.perSource).length === 0 ? <Stat label="Sources" value="None returned articles" /> : null}
        </StatGrid>
      </DataCard>
    </div>
  );
}
