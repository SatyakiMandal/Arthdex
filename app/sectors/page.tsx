import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NotSourced } from "@/components/ui/not-sourced";

export const metadata: Metadata = {
  title: "Sector KPIs · Arthdex",
  description: "Industry operating data by sector, shown once a real feed is connected.",
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] flex-1 px-2 pt-3 pb-4 sm:px-3 lg:px-4">
        <h1 className="text-2xl font-semibold">Sector operating KPIs</h1>
        <NotSourced title="Sector operating KPIs" path="/api/sectors/kpis" />
      </main>
      <SiteFooter />
    </div>
  );
}
