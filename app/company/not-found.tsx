import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function CompanyNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-20 sm:px-6">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Symbol not found</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          No listed company matches that symbol on NSE. Use the search field in the header:
          it covers every listed equity, and matches on company name as well as ticker.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/market-watch"
            className="inline-block rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs transition-colors hover:border-accent/50 hover:text-accent"
          >
            Market watch
          </Link>
          <Link
            href="/ipo"
            className="inline-block rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs transition-colors hover:border-accent/50 hover:text-accent"
          >
            IPO pipeline
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
