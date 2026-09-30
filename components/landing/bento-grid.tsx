import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CandlestickChart,
  Gauge,
  Newspaper,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  detail: string;
  href: string;
  className: string;
};

/*
 * Deliberately not three equal cards in a row, which is the default shape an
 * LLM reaches for and reads as templated. The grid is asymmetric: two wide
 * anchors carrying the substantive modules, four narrow supporting cards.
 */
const FEATURES: Feature[] = [
  {
    icon: CandlestickChart,
    title: "Company fundamentals and price",
    body: "Quarterly and annual statements, balance sheet, derived ratios, and an interactive chart across eight horizons.",
    detail: "Ratios state the period they cover, so a fiscal-year ROE is never read as trailing twelve months.",
    href: "/company/RELIANCE",
    className: "sm:col-span-2",
  },
  {
    icon: Gauge,
    title: "Volatility and risk models",
    body: "GARCH, EGARCH, FIGARCH and HAR-RV fitted on real returns, combined by out-of-sample error.",
    detail: "Merton distance to default plus parametric, historical and Monte Carlo value at risk.",
    href: "/company/RELIANCE/quant",
    className: "sm:col-span-2",
  },
  {
    icon: ShieldAlert,
    title: "Factor screens",
    body: "High beta, low volatility and alpha, regressed across index constituents.",
    detail: "Constituents with too little history are excluded, not defaulted.",
    href: "/market-watch",
    className: "",
  },
  {
    icon: Rocket,
    title: "Primary markets",
    body: "Mainboard and SME pipeline with subscription books.",
    detail: "Listing performance reconstructed from post-listing prices.",
    href: "/ipo",
    className: "",
  },
  {
    icon: Newspaper,
    title: "Filings and press",
    body: "Exchange disclosures tagged by category, alongside financial press.",
    detail: "Filings and commentary stay distinguishable.",
    href: "/news",
    className: "",
  },
  {
    icon: Bell,
    title: "Threshold alerts",
    body: "Conditions on price, P/E or P/B for any listed company.",
    detail: "Evaluated live when set.",
    href: "/alerts",
    className: "",
  },
];

function Card({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <Link
      href={feature.href}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50",
        feature.className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent" />
      </div>

      <h3 className="mt-4 text-pretty text-base font-semibold tracking-tight">{feature.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
      <p className="mt-3 border-t border-border pt-3 text-2xs leading-relaxed text-muted-foreground">
        {feature.detail}
      </p>
    </Link>
  );
}

export function BentoGrid() {
  return (
    <section id="capabilities" className="mx-auto max-w-[1600px] scroll-mt-28 px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Six desks, one data contract
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every module reads the same typed payloads, so a figure means the same thing
            wherever it appears.
          </p>
        </div>
        <p className="max-w-sm text-2xs leading-relaxed text-muted-foreground">
          Where a source cannot supply a number, the interface says so instead of filling the
          gap. Unlisted valuations, grey market premium and tick-level microstructure are all
          marked rather than invented.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  );
}
