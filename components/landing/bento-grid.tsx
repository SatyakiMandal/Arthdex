import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CandlestickChart,
  Coins,
  FlaskConical,
  Layers,
  LineChart,
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
  {
    icon: Layers,
    title: "NSE Bhavcopy",
    body: "Whole-market breadth, turnover and delivery for any trading date, with accumulation, volume-anomaly and circuit screens.",
    detail: "Built from NSE's own end-of-day file; delivery is what separates conviction buying from intraday churn.",
    href: "/bhavcopy",
    className: "sm:col-span-2",
  },
  {
    icon: FlaskConical,
    title: "Event impact analyzer",
    body: "Pick a company and a date range. The engine measures how its price moved against the benchmark on days with unusual news, then writes an eight-section dossier.",
    detail: "Investment call, sizing, technicals, risk, macro and peer valuation in one run.",
    href: "/analyzer",
    className: "sm:col-span-2",
  },
  {
    icon: Coins,
    title: "Metals and commodities",
    body: "Gold, silver, copper, aluminium, zinc, crude, natural gas and farm commodities, beside the Nifty Metal and Energy indices.",
    detail: "Rupee equivalents for gold and silver are labelled indicative: before duty, GST and premiums.",
    href: "/commodities",
    className: "sm:col-span-2",
  },
  {
    icon: LineChart,
    title: "Technical screener and charts",
    body: "MACD crossover screens on 5-minute to daily bars, and per-stock charts with Supertrend, VWAP, RSI, MFI, ATR and more.",
    detail: "You choose the bar size and how many bars back to look.",
    href: "/screener",
    className: "sm:col-span-2",
  },
];

function Card({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <Link
      href={feature.href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_18px_40px_-24px_hsl(var(--accent)/0.6)]",
        feature.className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/20 to-accent/5 text-accent shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
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
            Ten desks, one data contract
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
