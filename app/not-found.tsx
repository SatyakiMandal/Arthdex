import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BarChart3, Building2, Rocket, ScanSearch, Layers, Home } from "lucide-react";

const DESTINATIONS = [
  { label: "Market Watch", href: "/market-watch", icon: BarChart3 },
  { label: "Technical Screener", href: "/screener", icon: ScanSearch },
  { label: "Derivatives Desk", href: "/derivatives", icon: Layers },
  { label: "Unlisted Space", href: "/unlisted", icon: Building2 },
  { label: "IPO Intelligence", href: "/ipo", icon: Rocket },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-20 sm:px-6">
        <div className="max-w-2xl border border-border bg-surface p-8 sm:p-12">
          <p className="font-mono text-2xs font-semibold uppercase tracking-wider text-accent">404 · Not Found</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Page Not Found</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            The requested desk or ticker route does not exist or has been restructured. Use the universal search bar in the header, or navigate to one of the active desks below.
          </p>

          <div className="mt-8">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Active Desks</h2>
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {DESTINATIONS.map((d) => {
                const Icon = d.icon;
                return (
                  <li key={d.href}>
                    <Link
                      href={d.href}
                      className="inline-flex items-center gap-1.5 rounded-none border border-border bg-surface-muted px-3.5 py-2 text-xs font-medium transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {d.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-8 border-t border-border pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              Return to Terminal Overview
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
