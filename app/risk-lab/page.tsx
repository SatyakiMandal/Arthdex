import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NotSourced } from "@/components/ui/not-sourced";

export const metadata: Metadata = {
  title: "Risk lab · Arthdex",
  description: "Crisis stress tests and factor exposures, shown once they run on real histories.",
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] flex-1 px-2 pt-3 pb-4 sm:px-3 lg:px-4">
        <h1 className="text-2xl font-semibold">Risk lab</h1>
        <NotSourced title="Risk lab" path="/api/risk-lab/crisis-scenarios" />
      </main>
      <SiteFooter />
    </div>
  );
}
