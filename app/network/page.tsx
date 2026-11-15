import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Company ownership · Arthdex",
  description: "Look up who owns any NSE-listed company: promoters, promoter-group entities and large public shareholders, from its shareholding filing.",
};

/** The ownership view lives on each company's page; this page is the way in by ticker. */
export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const clean = (symbol ?? "").trim().toUpperCase();
  if (/^[A-Z0-9&_-]{1,20}$/.test(clean)) redirect(`/company/${encodeURIComponent(clean)}/network`);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-10 font-mono">
        <h1 className="text-base font-bold uppercase tracking-wider">Company ownership</h1>
        <p className="text-2xs text-muted-foreground">
          Enter an NSE ticker to see its promoters, promoter-group entities and public shareholders above 1%, as the company filed them with the exchange.
        </p>
        <form method="get" className="flex gap-2">
          <label className="sr-only" htmlFor="network-symbol">Ticker</label>
          <input
            id="network-symbol"
            name="symbol"
            placeholder="e.g. TECHM"
            maxLength={20}
            className="w-48 border border-border bg-surface-muted px-2 py-1.5 text-xs uppercase text-foreground focus:border-accent focus:outline-none"
          />
          <button type="submit" className="bg-accent px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-accent-foreground hover:brightness-110">
            Show ownership
          </button>
        </form>
        {clean ? <p className="text-2xs text-down" role="alert">That does not look like a ticker.</p> : null}
      </main>
      <SiteFooter />
    </div>
  );
}
