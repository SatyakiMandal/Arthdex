import { Users } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { deltaColor } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, inr, num, pct, stanceTone } from "./shared";

export function PeersTab({ s }: { s: ListedSummary }) {
  const p = s.detail.peers;
  const peers = s.detail.fundamental.peers;

  return (
    <div className="space-y-4">
      <DataCard
        title="Relative valuation"
        subtitle={p.sector ? `Against ${p.sector}` : "Against sector medians"}
        icon={Users}
        badge={p.stance ? <Pill label={p.rating ?? p.stance} tone={stanceTone(p.stance)} /> : undefined}
        footnote={p.stance ?? undefined}
      >
        <StatGrid cols={4}>
          <Stat label="Composite score" value={num(p.composite_score, 0)} />
          <Stat label="Peer-harmonised price" value={inr(p.target_price)} />
          <Stat label="Implied vs peers" value={pct(p.implied_upside_pct, 1)} tone={p.implied_upside_pct != null ? deltaColor(p.implied_upside_pct) : undefined} />
          <Stat label="Current price" value={inr(s.verdict?.price)} />
        </StatGrid>
        {p.table.length === 0 ? (
          <Empty>No multiples were computed.</Empty>
        ) : (
          <Table min={680} head={["Multiple", { label: "Company", right: true }, { label: "Sector median", right: true }, { label: "Variance", right: true }, "Stance"]}>
            {p.table.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <Td>
                  <p>{r.multiple}</p>
                  {r.role ? <p className="text-2xs text-muted-foreground">{r.role}</p> : null}
                </Td>
                <Td right>{num(r.value)}x</Td>
                <Td right>{num(r.sector_median)}x</Td>
                <Td right>{pct(r.variance_pct, 1)}</Td>
                <Td>{r.verdict ? <Pill label={r.verdict} tone={stanceTone(r.verdict)} /> : dash}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>

      {peers.length > 0 ? (
        <DataCard title="Screener peer set" subtitle="Companies screener.in groups with this one" icon={Users}>
          <div className="flex flex-wrap gap-2 p-4">
            {peers.map(([name, sym]) => (
              <a
                key={sym}
                href={`/company/${sym.replace(/\.(NS|BO)$/, "")}`}
                className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm hover:border-accent/50 hover:text-accent"
              >
                {name} <span className="font-mono text-2xs text-muted-foreground">{sym}</span>
              </a>
            ))}
          </div>
        </DataCard>
      ) : null}
    </div>
  );
}
