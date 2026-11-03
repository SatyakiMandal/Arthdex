import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "./motion";

const STEPS = [
  {
    title: "Ingestion",
    body: "Prices, exchange filings, press coverage, fundamentals and macro series are pulled from their public sources, de-duplicated and time-stamped. Anything that cannot be sourced is left blank, not estimated.",
  },
  {
    title: "Benchmark adjustment",
    body: "Each stock's return is regressed on its benchmark over a clean window. What is left, the abnormal return, is the part of a day's move the market does not explain.",
  },
  {
    title: "Synthesis",
    body: "Valuation, event flow, momentum, macro transmission and downside risk are scored, then weighted into one call with a stated conviction, entry zone, targets and stop. Every weight stays visible.",
  },
];

/** Method as a ledger: the heading holds the left column while the three steps read down the right. */
export function Methodology() {
  return (
    <section id="methodology" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 py-16 sm:px-6 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <h2 className="text-balance text-3xl sm:text-4xl">How an analysis is built</h2>
            <p className="mt-4 max-w-sm text-muted-foreground">The same three steps sit behind every dossier the analyzer produces.</p>
            <Link
              href="/methodology"
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Full methodology
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>

        <Stagger className="lg:col-span-8" gap={0.08}>
          <div role="list" className="border-t border-foreground/80">
            {STEPS.map((step, i) => (
              <StaggerItem key={step.title}>
                <div role="listitem" className="grid gap-3 border-b border-border py-7 sm:grid-cols-[4rem_14rem_1fr] sm:gap-6">
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg">{step.title}</h3>
                  <p className="max-w-[60ch] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>
    </section>
  );
}
