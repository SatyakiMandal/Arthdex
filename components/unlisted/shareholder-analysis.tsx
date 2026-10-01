import { Coins, PieChart, Users } from "lucide-react";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn, formatINR } from "@/lib/utils";
import type { HolderType, UnlistedCompany } from "@/types/unlisted";

const TYPE_LABEL: Record<HolderType, string> = {
  promoter: "Promoters",
  institutional: "Institutions & funds",
  angel: "Angels & individuals",
  employee: "Employees (ESOP)",
  strategic: "Strategic holders",
  other: "Others",
};
const TYPE_COLOR: Record<HolderType, string> = {
  promoter: "hsl(var(--accent))",
  institutional: "#22d3ee",
  angel: "#a78bfa",
  employee: "#fb923c",
  strategic: "hsl(var(--up))",
  other: "hsl(var(--muted-foreground) / 0.65)",
};

/**
 * Cap table and funding history for an unlisted company.
 *
 * Nothing publishes this for private companies in a form that can be fetched
 * automatically: it lives in Registrar of Companies filings (annual return
 * MGT-7, share-allotment forms) and in offer documents. So it is data-driven:
 * the section shows exactly what has been entered in data/unlisted.json, says
 * where it came from, and otherwise explains what is missing instead of
 * inventing a cap table.
 */
export function ShareholderAnalysis({ company }: { company: UnlistedCompany }) {
  const sh = company.shareholding;

  if (!sh || sh.holders.length === 0) {
    return (
      <DataCard
        title="Shareholder analysis"
        subtitle="Who owns the company and how that changed"
        icon={Users}
        badge={<StatusPill label="No data entered" tone="neutral" />}
        footnote="Arthdex does not estimate a cap table. An invented ownership split would be worse than none."
      >
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            Ownership of a private company is not published anywhere that can be read automatically. It sits in filings made
            to the Registrar of Companies and in offer documents.
          </p>
          <p className="font-medium text-foreground">What this section shows once data is entered</p>
          <ul className="list-inside list-disc space-y-1 text-2xs">
            <li>Ownership by group (promoters, funds, angels, employees) as a stacked bar and a ranked table</li>
            <li>Promoter control, and the largest outside holder</li>
            <li>Funding rounds, with amount, post-money valuation and investors</li>
            <li>Dilution from round to round, and the ESOP pool</li>
          </ul>
          <p className="text-2xs">
            Add a <code className="rounded bg-muted px-1 font-mono">shareholding</code> block to this company in{" "}
            <code className="rounded bg-muted px-1 font-mono">data/unlisted.json</code> with the holders, stakes, source and date.
            Useful sources include the annual return (Form MGT-7) and any draft offer document.
          </p>
        </div>
      </DataCard>
    );
  }

  const holders = [...sh.holders].sort((a, b) => b.stakePct - a.stakePct);
  const total = holders.reduce((a, h) => a + h.stakePct, 0);
  const byType = (Object.keys(TYPE_LABEL) as HolderType[])
    .map((t) => ({ type: t, pct: holders.filter((h) => h.type === t).reduce((a, h) => a + h.stakePct, 0) }))
    .filter((g) => g.pct > 0);
  const promoter = byType.find((g) => g.type === "promoter")?.pct ?? 0;
  const top = holders.filter((h) => h.type !== "promoter")[0];
  const top3 = holders.slice(0, 3).reduce((a, h) => a + h.stakePct, 0);
  const control = promoter >= 50 ? "Majority-controlled by promoters" : promoter >= 26 ? "Promoters hold a blocking stake" : "Promoters are a minority";
  const rounds = [...(sh.rounds ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid gap-4">
      <DataCard
        title="Shareholder analysis"
        subtitle={`Ownership as of ${sh.asOf}`}
        icon={PieChart}
        badge={<StatusPill label={control} tone={promoter >= 50 ? "up" : promoter >= 26 ? "flat" : "down"} />}
        footnote={`Source: ${sh.source}. Stakes are as entered and should add to 100%${Math.abs(total - 100) > 0.5 ? `; they currently add to ${total.toFixed(1)}%` : ""}.`}
      >
        <div className="p-4">
          <div className="flex h-3.5 overflow-hidden rounded-full bg-muted">
            {byType.map((g) => (
              <div key={g.type} title={`${TYPE_LABEL[g.type]} ${g.pct.toFixed(1)}%`} style={{ width: `${(g.pct / Math.max(total, 100)) * 100}%`, background: TYPE_COLOR[g.type] }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-2xs">
            {byType.map((g) => (
              <li key={g.type} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[g.type] }} />
                <span className="text-muted-foreground">{TYPE_LABEL[g.type]}</span>
                <span className="font-mono">{g.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-4">
          <Metric label="Promoter holding" value={`${promoter.toFixed(1)}%`} />
          <Metric label="Largest outside holder" value={top ? `${top.stakePct.toFixed(1)}%` : "—"} hint={top?.name} />
          <Metric label="Top three combined" value={`${top3.toFixed(1)}%`} />
          <Metric label="ESOP pool" value={sh.esopPoolPct != null ? `${sh.esopPoolPct.toFixed(1)}%` : "—"} />
        </div>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Holder</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Stake</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => (
                <tr key={h.name} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    {h.name}
                    {h.note ? <p className="text-2xs text-muted-foreground">{h.note}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-2xs text-muted-foreground">{TYPE_LABEL[h.type]}</td>
                  <td className="px-4 py-2 text-right">
                    <span className="font-mono">{h.stakePct.toFixed(2)}%</span>
                    <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (h.stakePct / (holders[0]?.stakePct || 1)) * 100)}%`, background: TYPE_COLOR[h.type] }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>

      {rounds.length > 0 ? (
        <DataCard title="Funding rounds" subtitle="Capital raised and the valuation it implied" icon={Coins} footnote="Post-money valuation is the value of the company immediately after the round, including the new money.">
          <ol className="divide-y divide-border">
            {rounds.map((r, i) => {
              const prev = rounds[i - 1]?.postMoneyCr;
              const step = prev && r.postMoneyCr ? (r.postMoneyCr / prev - 1) * 100 : null;
              return (
                <li key={`${r.date}-${r.round}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{r.round}</p>
                    <p className="font-mono text-2xs text-muted-foreground">{r.date}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">{r.investors.join(", ")}</p>
                  </div>
                  <div className="text-right font-mono text-sm">
                    ₹{formatINR(r.amountCr, 1)} Cr
                    {r.postMoneyCr != null ? (
                      <p className="text-2xs text-muted-foreground">
                        post-money ₹{formatINR(r.postMoneyCr, 0)} Cr
                        {step != null ? <span className={cn("ml-1", step >= 0 ? "text-up" : "text-down")}>({step >= 0 ? "+" : ""}{step.toFixed(0)}% vs prior)</span> : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </DataCard>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg">{value}</p>
      {hint ? <p className="truncate text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
