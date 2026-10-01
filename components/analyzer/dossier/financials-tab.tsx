import { Landmark, Package, Percent, Scale } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { deltaColor, formatINR } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Stat, StatGrid, Table, Td, dash, fracSigned, num } from "./shared";

const LINES: [string, string][] = [
  ["revenue", "Sales / revenue"],
  ["expenses", "Operating expenses"],
  ["operating_income", "Operating profit"],
  ["net_profit", "Net profit (PAT)"],
];

export function FinancialsTab({ s }: { s: ListedSummary }) {
  const f = s.detail.fundamental;
  const bs: Blk = f.balance_sheet ?? {};
  const ratios: Blk = f.ratios ?? {};
  const unit = f.unit ?? "";
  const money = (v: unknown) => (typeof v === "number" ? formatINR(v, 0) : dash);
  const r = (k: string) => (typeof ratios[k] === "number" ? (ratios[k] as number) : null);
  const hasAny = LINES.some(([k]) => f.lines[k]?.latest != null);
  const ob = f.order_book as Blk | null;

  return (
    <div className="space-y-4">
      <DataCard
        title="Latest quarter"
        subtitle={`${f.statement_kind ?? "Reported"} statements${f.as_of ? ` · quarter to ${f.as_of}` : ""}${unit ? ` · ${unit}` : ""}`}
        icon={Landmark}
        footnote={f.screener_url ? `Source: screener.in (${f.screener_url})` : "Source: screener.in"}
      >
        {!hasAny ? (
          <Empty>Screener.in returned no statement rows for this company.</Empty>
        ) : (
          <Table min={520} head={["Line item", { label: "Latest", right: true }, { label: "QoQ", right: true }, { label: "YoY", right: true }]}>
            {LINES.map(([k, label]) => {
              const l = f.lines[k];
              return (
                <tr key={k} className="border-b border-border last:border-0">
                  <Td>{label}</Td>
                  <Td right>{money(l?.latest)}</Td>
                  <Td right className={l?.qoq_change != null ? deltaColor(l.qoq_change) : ""}>{fracSigned(l?.qoq_change, 1)}</Td>
                  <Td right className={l?.yoy_change != null ? deltaColor(l.yoy_change) : ""}>{fracSigned(l?.yoy_change, 1)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
        {f.surprise?.has_data ? (
          <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
            {f.surprise.margin_compression ? "Operating margin compressed quarter on quarter. " : ""}
            {f.surprise.sequential_deceleration ? "Growth is decelerating sequentially." : ""}
          </p>
        ) : null}
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DataCard title="Balance sheet" subtitle="Annual, latest" icon={Scale}>
          <StatGrid cols={2}>
            <Stat label="Borrowings" value={money(bs.borrowings)} />
            <Stat label="Equity capital" value={money(bs.equity_capital)} />
            <Stat label="Reserves" value={money(bs.reserves)} />
            <Stat label="Total assets" value={money(bs.total_assets)} />
            <Stat label="Debt / equity" value={num(bs.debt_to_equity)} />
          </StatGrid>
        </DataCard>

        <DataCard title="Key ratios" icon={Percent} footnote={f.nopat_note ?? undefined}>
          <StatGrid cols={2}>
            <Stat label="ROE" value={r("ROE") != null ? `${num(r("ROE"), 1)}%` : dash} />
            <Stat label="ROCE" value={r("ROCE") != null ? `${num(r("ROCE"), 1)}%` : dash} />
            <Stat label="NOPAT" value={f.nopat != null ? money(f.nopat) : dash} hint={f.tax_rate_pct != null ? `Tax ${f.tax_rate_pct}%` : undefined} />
            <Stat label="Stock P/E" value={num(r("Stock P/E"), 1)} />
            <Stat label="Dividend yield" value={r("Dividend Yield") != null ? `${num(r("Dividend Yield"))}%` : dash} />
            <Stat label="Debtor days" value={num(r("Debtor Days"), 0)} />
            <Stat label="Cash conversion" value={num(r("Cash Conversion Cycle"), 0)} hint="days" />
            <Stat label="Working capital" value={num(r("Working Capital Days"), 0)} hint="days" />
          </StatGrid>
        </DataCard>
      </div>

      <DataCard
        title="Order book & capex execution"
        subtitle="Backlog relative to size, for defence, EPC and shipbuilding names"
        icon={Package}
      >
        {ob && typeof ob === "object" && Object.keys(ob).length > 0 ? (
          <StatGrid cols={4}>
            {Object.entries(ob)
              .filter(([, v]) => typeof v === "number" || typeof v === "string")
              .map(([k, v]) => (
                <Stat key={k} label={k.replace(/_/g, " ")} value={typeof v === "number" ? formatINR(v, 2) : String(v)} />
              ))}
          </StatGrid>
        ) : (
          <Empty>{f.order_book_note ?? "No order book was reported."}</Empty>
        )}
      </DataCard>
    </div>
  );
}
