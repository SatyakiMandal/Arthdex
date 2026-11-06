import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { ParticipantOiDesk } from "@/components/derivatives/participant-oi-desk";
import { getParticipantOi } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "F&O Participant Open Interest (PART) · Arthdex Terminal",
  description: "NSE daily participant open interest analytics: FII, DII, Proprietary and Retail positioning, long/short ratios, and institutional divergence signals.",
};

export const revalidate = 1800;

export default async function ParticipantOiPage() {
  const res = await getParticipantOi();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <ParticipantOiDesk initialData={res.data} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Participant OI Analytics Unavailable"
              message={res.message || "NSE clearing participant open interest report is temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
