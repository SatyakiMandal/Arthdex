import { Database, Layers3, Scale } from "lucide-react";
import { Reveal, SpotlightCard, Stagger, StaggerItem } from "./motion";

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
    <section id="methodology" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 py-16 sm:px-6 lg:py-24">
      <Reveal>
        <h2 className="text-gradient max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">How an analysis is built</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">The same three steps sit behind every dossier the analyzer produces.</p>
      </Reveal>

      <Stagger className="relative mt-10 grid gap-4 md:grid-cols-3" gap={0.12}>
        {/* Connector running behind the step badges on desktop */}
        <div
          className="pointer-events-none absolute left-[8%] right-[8%] top-[2.75rem] hidden h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent md:block"
          aria-hidden
        />
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <StaggerItem key={step.title} className="relative">
              <SpotlightCard className="group h-full rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_24px_48px_-32px_hsl(var(--accent)/0.6)]">
                <span className="pointer-events-none absolute -right-1 -top-5 select-none font-mono text-8xl font-bold text-accent/[0.06] transition-colors duration-300 group-hover:text-accent/[0.12]">
                  {i + 1}
                </span>
                <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/25 to-accent/5 text-accent transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </SpotlightCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
