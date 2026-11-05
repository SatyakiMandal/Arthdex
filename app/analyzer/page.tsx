import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Suspense } from "react";
import { Launcher } from "@/components/analyzer/launcher";
import { RunList } from "@/components/analyzer/run-list";
import { analyzerGet, listRuns } from "@/lib/api/analyzer";
import type { ModelStatus } from "@/types/analyzer";

export const metadata: Metadata = {
  title: "Event Impact Analyzer · Arthdex",
  description:
    "Search any listed or unlisted Indian company and run a full news-driven event study with technical, fundamental and risk analysis.",
};

export const dynamic = "force-dynamic";

export default async function AnalyzerPage() {
  const [mine, samples, models] = await Promise.all([
    listRuns("run"),
    listRuns("sample"),
    analyzerGet<ModelStatus>("/models"),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-accent" />
              <span>Event Impact Analyzer</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              News-Driven Abnormal Return Studies, Sentiment Shocks &amp; Multi-Factor Valuation
            </span>
          </div>
        </div>

        {models ? <ModelNotice status={models} /> : null}

        <div className="mt-2.5">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-none border border-border bg-surface" />}>
            <Launcher />
          </Suspense>
        </div>

        {mine === null && samples === null ? (
          <p role="alert" className="mt-3 rounded-none border border-down/40 bg-down/10 px-3 py-1.5 font-mono text-2xs text-down">
            The data service is not reachable, so runs cannot be started or listed.
          </p>
        ) : null}

        <section className="mt-4">
          <div className="border-b border-border/70 pb-1 flex items-baseline justify-between">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">Your Analyses</h2>
            <span className="text-3xs font-mono text-muted-foreground">Active and Completed Case Studies</span>
          </div>
          <div className="mt-2">
            <RunList deletable runs={mine?.runs ?? []} empty="Nothing run yet. Your finished reports will appear here." />
          </div>
        </section>

        <section className="mt-4">
          <div className="border-b border-border/70 pb-1 flex items-baseline justify-between">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">Reference Sample Reports</h2>
            <span className="text-3xs font-mono text-muted-foreground">Institutional Case Studies</span>
          </div>
          <div className="mt-2">
            <RunList runs={samples?.runs ?? []} empty="No sample reports are bundled." />
          </div>
        </section>

        <p className="mt-4 max-w-3xl font-mono text-3xs text-muted-foreground">
          Structured case-study engine, not investment advice. Coincidence between financial press coverage and abnormal market return is non-causal.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Says which sentiment engine the next run will use, so a degraded setup is never a surprise. */
function ModelNotice({ status }: { status: ModelStatus }) {
  const missing = status.models.filter((m) => !m.cached);
  const mb = missing.reduce((sum, m) => sum + m.approxMb, 0);

  if (status.mode === "off") {
    return <Note tone="flat">Language models are switched off (ARTHDEX_ML=off). News is scored with a simple word list.</Note>;
  }
  if (!status.packagesInstalled && !status.required) {
    return (
      <Note tone="flat">
        The language-model packages (torch, transformers) are not installed, so news is scored with a simple word list
        and emotion tags are skipped. Install backend/requirements.txt for the full FinBERT and GoEmotions analysis.
      </Note>
    );
  }
  if (missing.length > 0) {
    return (
      <Note tone="flat">
        FinBERT and GoEmotions are not on this machine yet. They download once (about {mb} MB) before the next run. To fetch
        them now, run <code className="font-mono">python scripts/download_models.py</code> in the backend folder.
      </Note>
    );
  }
  return <Note tone="up">Sentiment engine ready: FinBERT for tone and GoEmotions for emotion tags.</Note>;
}

function Note({ tone, children }: { tone: "up" | "flat"; children: React.ReactNode }) {
  const style = tone === "up" ? "border-up/30 bg-up/5 text-muted-foreground" : "border-flat/40 bg-flat/10 text-foreground";
  return <p className={`mt-2.5 max-w-full rounded-none border px-2.5 py-1.5 font-mono text-3xs ${style}`}>{children}</p>;
}
