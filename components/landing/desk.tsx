import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "./motion";
import { getFactorScreens, getIpoPipeline, getUnlistedDirectory } from "@/lib/api/endpoints";
import { cn, formatINR, formatPct } from "@/lib/utils";

function CellHead({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-lg">{title}</h3>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent underline-offset-4 hover:underline">
        {cta}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

const dateFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "TBA";

/**
 * The tools, each shown working on today's data instead of described: the
 * analyzer as the brand block, the alpha screen, the IPO book and the unlisted
 * directory. Every cell is a different shape and surface, so the grid has rhythm.
 */
export async function Desk() {
  const [factors, ipo, unlisted] = await Promise.all([getFactorScreens("nifty100", 5), getIpoPipeline(), getUnlistedDirectory()]);
  const alpha = factors?.data.alpha.slice(0, 5) ?? [];
  const issues = ipo.ok
    ? ipo.data.issues.filter((i) => i.status === "ongoing" || i.status === "upcoming").slice(0, 4)
    : [];
  const priced = unlisted.ok ? unlisted.data.companies.filter((c) => c.price !== null).slice(0, 4) : [];

  return (
    <section className="border-y border-border bg-surface-muted/50">
      <div className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="max-w-2xl text-balance text-3xl sm:text-4xl">One desk for listed, unlisted and new issues</h2>
        </Reveal>

        <div className="mt-10 grid gap-4 lg:auto-rows-[minmax(15rem,auto)] lg:grid-cols-12">
          {/* Brand block: the analyzer, in the logo's navy with its gold rule */}
          <Reveal className="relative flex flex-col overflow-hidden rounded-xl bg-[#0B2D5B] p-6 text-[#E8EEF4] sm:p-8 lg:col-span-5 lg:row-span-2">
            <span className="font-deva text-[9rem] leading-none text-white/[0.06] absolute -bottom-6 -right-2 select-none" aria-hidden>
              अर्थ
            </span>
            <span className="h-px w-10 bg-[#F4B942]" aria-hidden />
            <h3 className="mt-6 max-w-sm text-balance text-3xl leading-tight">Measure what one event did to a stock.</h3>
            <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-[#E8EEF4]/75">
              The analyzer reads the news and filings around a date, strips out the market&apos;s own move, and reports the abnormal
              return with its confidence, a valuation and a stated call.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[#E8EEF4]/85">
              {["Market-adjusted abnormal returns around the date", "FinBERT sentiment on every headline", "Report, workbook and raw JSON"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="h-1 w-1 bg-[#F4B942]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/analyzer"
              className="group relative mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-[#F4B942] px-4 py-2.5 text-sm font-medium text-[#0B2D5B] transition-transform active:scale-[0.98]"
            >
              Run an analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          {/* Alpha screen as a live ranking */}
          <Reveal delay={0.05} className="rounded-xl border border-border bg-surface p-6 lg:col-span-7">
            <CellHead title="Beating the market this year" href="/screener" cta="Open screener" />
            <p className="mt-1 text-2xs text-muted-foreground">Jensen&apos;s alpha against Nifty 50, Nifty 100 members</p>
            {alpha.length ? (
              <ol className="mt-5 divide-y divide-border/70">
                {alpha.map((r, i) => (
                  <li key={r.symbol}>
                    <Link href={`/company/${r.symbol}`} className="group grid grid-cols-[1.5rem_1fr_auto_auto] items-baseline gap-4 py-2.5 text-sm">
                      <span className="font-mono text-2xs text-muted-foreground tabular-nums">{i + 1}</span>
                      <span className="min-w-0 truncate">
                        <span className="font-medium group-hover:underline">{r.symbol}</span>
                        <span className="ml-2 hidden text-muted-foreground sm:inline">{r.industry}</span>
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground tabular-nums">β {r.beta.toFixed(2)}</span>
                      <span className={cn("w-16 text-right font-mono tabular-nums", r.jensensAlphaPct >= 0 ? "text-up" : "text-down")}>
                        {formatPct(r.jensensAlphaPct, 1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">The factor screen is still computing. It fills in after the first request.</p>
            )}
          </Reveal>

          {/* IPO book */}
          <Reveal delay={0.1} className="rounded-xl border border-border bg-surface p-6 lg:col-span-4">
            <CellHead title="Issues on the book" href="/ipo" cta="IPO desk" />
            {issues.length ? (
              <ul className="mt-5 space-y-3">
                {issues.map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.name ?? i.symbol}</span>
                      <span className="text-2xs text-muted-foreground">
                        {i.status === "ongoing" ? "Open, closes" : "Opens"} {dateFmt(i.status === "ongoing" ? i.issueEndDate : i.issueStartDate)}
                        {i.segment === "sme" ? ", SME" : ""}
                      </span>
                    </span>
                    {i.priceBandHigh ? (
                      <span className="shrink-0 font-mono text-xs tabular-nums">₹{formatINR(i.priceBandHigh, 0)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">No issue is open or announced right now.</p>
            )}
          </Reveal>

          {/* Unlisted directory: the count leads */}
          <Reveal delay={0.15} className="flex flex-col rounded-xl border border-border bg-surface p-6 lg:col-span-3">
            <CellHead title="Unlisted" href="/unlisted" cta="Directory" />
            {unlisted.ok ? (
              <>
                <p className="mt-4 font-display text-5xl font-semibold tabular-nums">{unlisted.data.total}</p>
                <p className="text-2xs text-muted-foreground">private companies with dealer prices</p>
                <ul className="mt-auto space-y-1.5 pt-5 text-sm">
                  {priced.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <Link href={`/unlisted/${c.id}`} className="truncate hover:underline">{c.name}</Link>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">₹{formatINR(c.price!, 0)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">{unlisted.message}</p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
