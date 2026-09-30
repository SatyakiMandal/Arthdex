import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

const DESTINATIONS = [
  { label: "Market watch", href: "/#market-watch" },
  { label: "Companies", href: "/company/GRSE" },
  { label: "Unlisted space", href: "/unlisted" },
  { label: "IPO intelligence", href: "/ipo" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-20 sm:px-6">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          That route does not exist. Try one of the sections below, or use the search field
          in the header.
        </p>

        <ul className="mt-8 flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="inline-block rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs transition-colors hover:border-accent/50 hover:text-accent"
              >
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
