import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarDays,
  Coins,
  FlaskConical,
  Gauge,
  Layers,
  Newspaper,
  Rocket,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  Star,
  Sunrise,
} from "lucide-react";

const COLUMNS = [
  {
    title: "Markets",
    links: [
      { label: "Market watch", href: "/market-watch", icon: BarChart3 },
      { label: "Commodities", href: "/commodities", icon: Coins },
      { label: "Technical screener", href: "/screener", icon: ScanSearch },
      { label: "Order flow", href: "/orderflow", icon: Activity },
      { label: "NSE Bhavcopy", href: "/bhavcopy", icon: Layers },
      { label: "Bulk & block deals", href: "/deals", icon: ArrowLeftRight },
      { label: "Results calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    title: "Companies",
    links: [
      { label: "IPO intelligence", href: "/ipo", icon: Rocket },
      { label: "Unlisted space", href: "/unlisted", icon: Building2 },
      { label: "Filings & news", href: "/news", icon: Newspaper },
      { label: "Event impact analyzer", href: "/analyzer", icon: FlaskConical },
      { label: "Watchlist", href: "/watchlist", icon: Star },
      { label: "Morning briefing", href: "/briefing", icon: Sunrise },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/40">
      <div className="mx-auto grid w-full max-w-[1920px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_repeat(2,0.6fr)_1.6fr]">
        <div>
          <Link href="/" className="inline-flex">
            <Logo full />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Indian market analytics computed from exchange data and filings, with the workings shown.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} /> Every figure states its source
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-xs font-medium text-foreground">{col.title}</h3>
            <ul className="mt-3 space-y-0.5">
              {col.links.map((l) => {
                return (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-2xs font-semibold text-flat">
            <AlertTriangle className="h-3.5 w-3.5" /> Important
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
            For research and quantitative analysis only. Nothing here is investment advice or a solicitation, and Arthdex is not
            a SEBI-registered investment adviser. Model outputs are estimates from limited data and past behaviour. Grey-market
            premiums are unofficial, unregulated quotes. Unlisted prices are dealer quotes, not exchange prints. Check figures
            against primary filings before acting.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-2xs">
            <Link href="/methodology" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ScrollText className="h-3 w-3" /> Methodology
            </Link>
            <Link href="/status" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Gauge className="h-3 w-3" /> Data status
            </Link>
          </p>
        </div>
      </div>

      {/* Sign-off: the name set as large as the page allows, artha (wealth, meaning) beside it */}
      <div className="mx-auto w-full max-w-[1920px] overflow-hidden px-4 sm:px-6">
        <div className="flex items-end justify-between gap-6 border-t border-border pt-6">
          <p className="select-none font-display text-[clamp(4rem,17vw,15rem)] font-semibold leading-[0.78] tracking-[-0.055em] text-foreground/[0.9]" aria-hidden>
            Arthdex
          </p>
          <p className="mb-2 hidden shrink-0 text-right md:block">
            <span className="block font-deva text-4xl text-gold" lang="hi">अर्थ</span>
            <span className="mt-1 block text-2xs text-muted-foreground">artha: wealth, and meaning</span>
          </p>
        </div>
        <p className="flex flex-wrap justify-between gap-2 py-5 text-2xs text-muted-foreground">
          <span>Arthdex. Indian market analytics.</span>
          <span>NSE and Yahoo Finance data, delayed. Not investment advice.</span>
        </p>
      </div>
    </footer>
  );
}
