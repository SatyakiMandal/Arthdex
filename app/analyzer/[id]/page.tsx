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
      <main id="main" className="mx-auto max-w-[1800px] px-3 py-6 sm:px-5">
        <RunView initial={run} />
      </main>
      <SiteFooter />
    </div>
  );
}
