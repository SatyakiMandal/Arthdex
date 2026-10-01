import { Clock, Scale, Target, ShieldX } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Gauge, ScoreBar } from "@/components/ui/gauge";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { Bullets, Empty, Pill, Stat, Table, Td, dash, inr, num, pct, stanceTone } from "./shared";

export function CallTab({ s }: { s: ListedSummary }) {
  const v = s.verdict;
  const { sizing, holding, pillar_rationales } = s.detail;

  return (
    <div className="space-y-4">
      {v ? (
        <DataCard
          title="Investment call"
          subtitle={`Synthesised from five weighted pillars${v.asOf ? ` · as of ${v.asOf}` : ""}`}
          icon={Target}
          badge={v.call ? <Pill label={v.call} tone={stanceTone(v.call)} /> : undefined}
          footnote="A model output that combines the event study, technicals, valuation, macro and solvency scores. It is not investment advice."
        >
          <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.8fr)]">
            <div>
              <Gauge value={v.conviction ?? 0} label="Conviction" className="pt-2" />
              {v.summary ? <p className="mt-5 text-center text-sm text-muted-foreground">{v.summary}</p> : null}
              <div className="mt-5 grid grid-cols-2 gap-3 [&>div]:rounded-lg [&>div]:border [&>div]:border-border [&>div]:bg-surface-muted/50 [&>div]:px-3 [&>div]:py-2">
                <Stat label="Price" value={inr(v.price)} />
                <Stat label="Entry accumulation zone" value={v.entryLow != null ? `${inr(v.entryLow)} – ${inr(v.entryHigh)}` : dash} />
                <Stat label="Target 1 · tactical" value={`${inr(v.target1)} (${pct(v.target1Pct, 1)})`} tone="text-up" />
                <Stat label="Target 2 · structural" value={`${inr(v.target2)} (${pct(v.target2Pct, 1)})`} tone="text-up" />
                <Stat label="Hard stop-loss" value={`${inr(v.stop)} (${v.stopPct != null ? `-${v.stopPct.toFixed(1)}%` : dash})`} tone="text-down" />
                <Stat label="Risk / reward" value={v.riskReward ?? dash} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Pillar</th>
                    <th className="pb-2 text-right font-medium">Weight</th>
                    <th className="pb-2 text-right font-medium">Score</th>
                    <th className="pb-2 pl-3 font-medium">Stance</th>
                  </tr>
                </thead>
                <tbody>
                  {v.pillars.map((p, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-2 pr-2">
                        <p>{p.name}</p>
                        {p.highlight ? <p className="mt-0.5 text-2xs text-muted-foreground">{p.highlight}</p> : null}
                        {pillar_rationales[i] ? (
                          <p className="mt-0.5 text-2xs text-muted-foreground/80">{pillar_rationales[i]}</p>
                        ) : null}
                      </td>
                      <td className="py-2 text-right font-mono">{p.weight != null && p.weight > 0 ? `${p.weight}%` : dash}</td>
                      <td className="py-2 text-right">
                        {p.stance === "Not assessed" ? (
                          <span className="font-mono text-muted-foreground">{dash}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <ScoreBar score={p.score} />
                            <span className={cn("w-8 font-mono", p.score != null ? deltaColor(p.score) : "")}>{num(p.score, 0)}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pl-3">{p.stance ? <Pill label={p.stance} tone={stanceTone(p.stance)} hint={pillar_rationales[i] ?? undefined} /> : dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {v.thesis ? <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{v.thesis}</p> : null}
        </DataCard>
      ) : (
        <DataCard title="Investment call" icon={Target}>
          <Empty>The engine did not produce a verdict for this run.</Empty>
        </DataCard>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <DataCard
        title="Half-Kelly position sizing"
        subtitle="Capital to commit at three portfolio sizes, capped so a stop-out costs well under 1% of the book"
        icon={Scale}
        badge={sizing.half_kelly_pct != null ? <Pill label={`Half-Kelly ${sizing.half_kelly_pct.toFixed(1)}%`} tone="flat" /> : undefined}
        footnote={`Full Kelly is ${num(sizing.raw_kelly_pct, 1)}% of capital; the model takes half of it, then applies a ${num(sizing.cap_pct, 1)}% single-name cap, which is what binds. Kelly sizing assumes the edge estimate is right; treat it as a ceiling.`}
      >
        {sizing.tiers.length === 0 ? (
          <Empty>No sizing tiers were produced.</Empty>
        ) : (
          <Table
            min={640}
            head={[
              "Tier",
              { label: "Allocation", right: true },
              { label: "Capital", right: true },
              { label: "Shares", right: true },
              { label: "Loss at stop", right: true },
              { label: "Book risk", right: true },
            ]}
          >
            {sizing.tiers.map((t) => (
              <tr key={t.portfolio_name} className="border-b border-border last:border-0">
                <Td>{t.portfolio_name}</Td>
                <Td right>{t.allocation_pct.toFixed(1)}%</Td>
                <Td right>₹{formatINR(t.allocated_capital_inr, 0)}</Td>
                <Td right>{formatINR(t.prescribed_shares, 0)}</Td>
                <Td right className="text-down">₹{formatINR(t.risk_at_stop_loss_inr, 0)}</Td>
                <Td right>{t.portfolio_risk_pct.toFixed(2)}%</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>

        <DataCard title="Holding horizon" subtitle="How long the thesis is expected to take" icon={Clock}>
          <div className="space-y-3 p-4">
            <Stat label="Core holding" value={<span className="font-sans text-sm">{holding.core ?? dash}</span>} />
            <Stat label="Tactical swing" value={<span className="font-sans text-sm">{holding.tactical ?? dash}</span>} />
          </div>
          {holding.profit_booking.length > 0 ? (
            <div className="border-t border-border">
              <p className="px-4 pt-3 text-2xs uppercase tracking-wider text-muted-foreground">Profit-booking rules</p>
              <Bullets items={holding.profit_booking} />
            </div>
          ) : null}
        </DataCard>

        <DataCard
          title="Setup invalidation"
          subtitle="Conditions that cancel the recommendation"
          icon={ShieldX}
        >
          {holding.invalidation.length > 0 ? <Bullets items={holding.invalidation} /> : <Empty>No invalidation rules were produced.</Empty>}
        </DataCard>
      </div>
    </div>
  );
}
