import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
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

      <main id="main" className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <div className="max-w-3xl">
          <Eyebrow icon={FlaskConical}>Event impact analyzer</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            What did the news do to the stock?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Pick a company and a window. The analyzer scrapes Indian financial press, aligns
            coverage against benchmark-adjusted returns, flags the days where unusual coverage
            met an unusual move, and layers on volatility, risk, technical and valuation
            models. Unlisted names get a dealer-price move study attributed to headlines.
          </p>
        </div>

        {models ? <ModelNotice status={models} /> : null}

        <div className="mt-8">
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl border border-border bg-surface" />}>
            <Launcher />
          </Suspense>
        </div>

        {mine === null && samples === null ? (
          <p role="alert" className="mt-8 rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
            The data service is not reachable, so runs cannot be started or listed.
          </p>
        ) : null}

        <section className="mt-12">
          <h2 className="text-sm font-semibold tracking-tight">Your analyses</h2>
          <p className="mt-1 text-2xs text-muted-foreground">Runs started from this page, newest first.</p>
          <div className="mt-4">
            <RunList deletable runs={mine?.runs ?? []} empty="Nothing run yet. Your finished reports will appear here." />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-semibold tracking-tight">Sample reports</h2>
          <p className="mt-1 text-2xs text-muted-foreground">
            Reports the tool generated earlier, kept as they were produced. Their dates reflect
            when they were run, not today.
          </p>
          <div className="mt-4">
            <RunList runs={samples?.runs ?? []} empty="No sample reports are bundled." />
          </div>
        </section>

        <p className="mt-12 max-w-3xl text-2xs text-muted-foreground">
          A structured case-study generator, not a trading signal. Coincidence between coverage
          and a price move is not proof of causation, and the model-derived calls in each
          report are outputs of the analysis, not investment advice.
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
  return <p className={`mt-6 max-w-3xl rounded-xl border px-4 py-2.5 text-2xs ${style}`}>{children}</p>;
}
