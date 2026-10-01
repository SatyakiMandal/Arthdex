import { Database, Layers3, Scale } from "lucide-react";

const STEPS = [
  {
    icon: Database,
    title: "Ingestion",
    body: "Prices, exchange filings, financial-press coverage, screener fundamentals and macro series are pulled from their public sources, de-duplicated and time-stamped. Anything that cannot be sourced is left blank, not estimated.",
  },
  {
    icon: Scale,
    title: "Benchmark adjustment",
    body: "Each stock's return is regressed on its benchmark over a clean estimation window. What is left, the abnormal return, is the part of a day's move the market does not explain. Days where abnormal return and unusual news coverage coincide are flagged.",
  },
  {
    icon: Layers3,
    title: "Multi-pillar synthesis",
    body: "Valuation, event flow, technical momentum, macro transmission and downside risk are each scored, then weighted into one call with a stated conviction, entry zone, targets and a stop. The weights and every input stay visible.",
  },
];

export function Methodology() {
  return (
    <section id="methodology" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 pb-16 sm:px-6">
      <h2 className="text-gradient text-balance text-3xl font-semibold tracking-tight sm:text-4xl">How an analysis is built</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The same three steps sit behind every dossier the analyzer produces.
      </p>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40">
              <span className="pointer-events-none absolute -right-2 -top-4 select-none font-mono text-7xl font-bold text-accent/[0.07]">{i + 1}</span>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
