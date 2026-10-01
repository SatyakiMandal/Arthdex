import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { CalendarView } from "@/components/market/calendar-view";
import { getCalendar } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Results & Corporate Actions Calendar · Arthdex",
  description: "Upcoming board meetings and results dates, dividends, splits, bonuses and rights for the next 30 days.",
};

export default async function CalendarPage() {
  const result = await getCalendar();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={CalendarDays}>Calendar</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Results &amp; corporate actions
            </h1>
            <p className="mt-3 text-muted-foreground">
              Board meetings and results dates, plus dividends, splits, bonuses and rights over the next 30 days.
            </p>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
        </div>

        <div className="mt-8">
          {result.ok ? (
            <>
              {result.data.errors ? (
                <p className="mb-4 rounded-xl border border-flat/40 bg-flat/[0.07] px-4 py-2.5 text-2xs text-flat">
                  Part of the calendar could not be loaded ({result.data.errors.join(", ")}). What is shown is complete for the
                  feeds that did load.
                </p>
              ) : null}
              <CalendarView calendar={result.data} />
              <SourceLine meta={result.meta} className="mt-4" />
            </>
          ) : (
            <DataUnavailable title="Calendar unavailable" message={result.message} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
