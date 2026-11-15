import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NotSourced } from "@/components/ui/not-sourced";

export const metadata: Metadata = {
  title: "Corporate network · Arthdex",
  description: "Group structures and supply chains, shown once filings are parsed for them.",
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] flex-1 px-2 pt-3 pb-4 sm:px-3 lg:px-4">
        <h1 className="text-2xl font-semibold">Corporate network</h1>
        <NotSourced title="Corporate network" path="/api/v1/network/summary?symbol=M%26M" />
      </main>
      <SiteFooter />
    </div>
  );
}
