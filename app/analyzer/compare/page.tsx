import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Columns2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { dash, inr, num, pct } from "@/components/analyzer/dossier/shared";
import { analyzerGet } from "@/lib/api/analyzer";
import { cn, deltaColor } from "@/lib/utils";
import type { AnalyzerSummary, ListedSummary, UnlistedSummary } from "@/types/analyzer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare analyses · Arthdex" };

type Props = { searchParams: Promise<{ a?: string; b?: string }> };

interface Row {
  label: string;
  a: string;
  b: string;
  /** Raw numbers, so the stronger side can be highlighted where "higher" has a meaning. */
  av?: number | null;
  bv?: number | null;
  tone?: boolean;
}

function listedRows(a: ListedSummary, b: ListedSummary): Row[] {
  const va = a.verdict;
  const vb = b.verdict;
  return [
    { label: "Window", a: `${a.start} to ${a.end}`, b: `${b.start} to ${b.end}` },
    { label: "Call", a: va?.call ?? dash, b: vb?.call ?? dash },
    { label: "Conviction", a: num(va?.conviction, 0), b: num(vb?.conviction, 0), av: va?.conviction, bv: vb?.conviction },
    { label: "Price at analysis", a: inr(va?.price), b: inr(vb?.price) },
    { label: "Target 1", a: inr(va?.target1), b: inr(vb?.target1) },
    { label: "Target 1 move", a: pct(va?.target1Pct), b: pct(vb?.target1Pct), av: va?.target1Pct, bv: vb?.target1Pct, tone: true },
    { label: "Stop", a: inr(va?.stop), b: inr(vb?.stop) },
    { label: "Risk / reward", a: va?.riskReward ?? dash, b: vb?.riskReward ?? dash },
    { label: "Market beta", a: num(a.market.beta), b: num(b.market.beta) },
    { label: "Alpha", a: num(a.market.alpha, 4), b: num(b.market.alpha, 4) },
    { label: "R squared", a: num(a.market.rSquared), b: num(b.market.rSquared) },
    { label: "News items used", a: String(a.news.items ?? dash), b: String(b.news.items ?? dash) },
    { label: "Unusual-event days", a: String(a.incidentCount), b: String(b.incidentCount) },
    { label: "Annualised volatility", a: pct(a.risk.annualisedVol), b: pct(b.risk.annualisedVol) },
    { label: "Technical rating", a: a.technical.rating ?? dash, b: b.technical.rating ?? dash },
    { label: "Regime", a: a.risk.regime ?? dash, b: b.risk.regime ?? dash },
  ];
}

function unlistedRows(a: UnlistedSummary, b: UnlistedSummary): Row[] {
  return [
    { label: "Window", a: `${a.start} to ${a.end}`, b: `${b.start} to ${b.end}` },
    { label: "First quote", a: inr(a.price.first), b: inr(b.price.first) },
    { label: "Latest quote", a: inr(a.price.last), b: inr(b.price.last) },
    { label: "Change", a: pct(a.price.changePct), b: pct(b.price.changePct), av: a.price.changePct, bv: b.price.changePct, tone: true },
    { label: "High", a: inr(a.price.high), b: inr(b.price.high) },
    { label: "Low", a: inr(a.price.low), b: inr(b.price.low) },
    { label: "Price revisions", a: String(a.moveCount), b: String(b.moveCount) },
    { label: "News items", a: String(a.news.items ?? dash), b: String(b.news.items ?? dash) },
  ];
}

export default async function ComparePage({ searchParams }: Props) {
  const { a, b } = await searchParams;
  const ok = (v?: string) => !!v && /^[A-Za-z0-9._-]+$/.test(v);
  const [sa, sb] =
    ok(a) && ok(b)
      ? await Promise.all([
          analyzerGet<AnalyzerSummary>(`/runs/${a}/summary`),
          analyzerGet<AnalyzerSummary>(`/runs/${b}/summary`),
        ])
      : [null, null];

  let rows: Row[] | null = null;
  let problem: string | null = null;
  if (!sa || !sb) problem = "One or both analyses could not be loaded. They may have been deleted, or the data service is not running.";
  else if (sa.kind !== sb.kind) problem = "A listed and an unlisted analysis measure different things, so they cannot be compared side by side.";
  else rows = sa.kind === "listed" ? listedRows(sa, sb as ListedSummary) : unlistedRows(sa, sb as UnlistedSummary);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <Link href="/analyzer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All analyses
        </Link>
        <div className="mt-4">
          <Eyebrow icon={Columns2}>Compare</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight">Side by side</h1>
        </div>

        {problem || !rows || !sa || !sb ? (
          <p role="alert" className="mt-8 rounded-xl border border-flat/40 bg-flat/[0.07] px-4 py-3 text-sm">
            {problem}
          </p>
        ) : (
          <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/40">
                    <th className="px-4 py-3 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">Measure</th>
                    <th className="px-4 py-3 text-right">
                      <Link href={`/analyzer/${a}`} className="font-semibold hover:text-accent">
                        {sa.company}
                      </Link>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <Link href={`/analyzer/${b}`} className="font-semibold hover:text-accent">
                        {sb.company}
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const better = r.av != null && r.bv != null && r.av !== r.bv ? (r.av > r.bv ? "a" : "b") : null;
                    return (
                      <tr key={r.label} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">{r.label}</td>
                        <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", r.tone && r.av != null && deltaColor(r.av), better === "a" && "font-semibold")}>
                          {r.a}
                        </td>
                        <td className={cn("px-4 py-2.5 text-right font-mono tabular-nums", r.tone && r.bv != null && deltaColor(r.bv), better === "b" && "font-semibold")}>
                          {r.b}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
              Descriptive statistics from each run&apos;s own window, not a recommendation. Runs over different windows are not
              directly comparable.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
