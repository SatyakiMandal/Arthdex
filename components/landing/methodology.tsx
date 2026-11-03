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

/** Method as a compact strip: the heading on the left, the three steps side by side. */
export function Methodology() {
  return (
    <section id="methodology" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 pb-10 pt-8 sm:px-6 lg:pb-12 lg:pt-10">
      <div className="grid gap-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-3">
          <h2 className="text-balance text-3xl sm:text-4xl">How an analysis is built</h2>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">The same three steps sit behind every dossier the analyzer produces.</p>
          <Link href="/methodology" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline">
            Full methodology
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>

        <Stagger className="lg:col-span-9" gap={0.08}>
          <div role="list" className="grid gap-x-8 gap-y-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <StaggerItem key={step.title}>
                <div role="listitem" className="border-t border-foreground/80 pt-3">
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>
    </section>
  );
}
