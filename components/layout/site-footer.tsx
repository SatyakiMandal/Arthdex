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
    <footer className="relative mt-16 border-t border-border bg-gradient-to-b from-surface-muted/40 to-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_repeat(2,0.6fr)_1.6fr]">
        <div>
          <Link href="/" aria-label="Arthdex home" className="inline-flex">
            <Logo full />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Indian market analytics computed from exchange data and filings, with the workings shown.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-2xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-up" /> Every figure states its source
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.href}>
                    <Link href={l.href} className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                      <Icon className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:text-accent group-hover:opacity-100" />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}

        <div className="rounded-xl border border-flat/25 bg-flat/5 p-4">
          <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.18em] text-flat">
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
    </footer>
  );
}
