import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { RunView } from "@/components/analyzer/run-view";
import { getRun } from "@/lib/api/analyzer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const run = await getRun(id);
  return { title: run ? `${run.company} · Analyzer · Arthdex` : "Analysis · Arthdex" };
}

export default async function RunPage({ params }: Props) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <RunView initial={run} />
      </main>
      <SiteFooter />
    </div>
  );
}
