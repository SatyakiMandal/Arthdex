import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Columns2, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ComparePending } from "@/components/analyzer/compare/compare-pending";
import { ListedCompare } from "@/components/analyzer/compare/listed-compare";
import { UnlistedCompare } from "@/components/analyzer/compare/unlisted-compare";
import { analyzerGet, getRun } from "@/lib/api/analyzer";
import type { AnalyzerRun, AnalyzerSummary, ListedSummary, UnlistedSummary } from "@/types/analyzer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare analyses · Arthdex" };

type Props = { searchParams: Promise<{ a?: string; b?: string }> };

const okId = (v?: string) => !!v && /^[A-Za-z0-9._-]+$/.test(v);

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-8 rounded-xl border border-flat/40 bg-flat/[0.07] px-4 py-3 text-sm">
      {children}
    </p>
  );
}

function Side({ run, tone }: { run: AnalyzerRun; tone: "a" | "b" }) {
  return (
    <div className={`min-w-0 rounded-2xl border bg-surface p-4 ${tone === "a" ? "border-accent/40" : "border-flat/40"}`}>
      <p className={`font-mono text-2xs uppercase tracking-wider ${tone === "a" ? "text-accent" : "text-flat"}`}>{tone === "a" ? "Company A" : "Company B"}</p>
      <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{run.company}</h2>
      <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
        {run.ticker ?? "Unlisted"} · {run.start} to {run.end}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-2xs">
        <Link href={`/analyzer/${run.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
          Open analysis
        </Link>
        {run.hasReport ? (
          <a href={`/api/analyzer/runs/${run.id}/report`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            Full report <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default async function ComparePage({ searchParams }: Props) {
  const { a, b } = await searchParams;

  const [runA, runB] = okId(a) && okId(b) ? await Promise.all([getRun(a!), getRun(b!)]) : [null, null];

  let body: React.ReactNode;
  if (!runA || !runB) {
    body = <Notice>One or both analyses could not be found. They may have been deleted, or the data service is not running.</Notice>;
  } else if (runA.kind !== runB.kind) {
    body = <Notice>A listed and an unlisted analysis measure different things, so they cannot be compared side by side. Pick two companies of the same kind.</Notice>;
  } else if (runA.status !== "COMPLETED") {
    body = <Notice>The first analysis ({runA.company}) has not finished, so there is nothing to compare yet.</Notice>;
  } else if (runB.status === "QUEUED" || runB.status === "RUNNING") {
    body = <ComparePending runId={runB.id} company={runB.company} />;
  } else if (runB.status !== "COMPLETED") {
    body = <ComparePending runId={runB.id} company={runB.company} />;
  } else {
    const [sa, sb] = await Promise.all([analyzerGet<AnalyzerSummary>(`/runs/${runA.id}/summary`), analyzerGet<AnalyzerSummary>(`/runs/${runB.id}/summary`)]);
    if (!sa || !sb) body = <Notice>The results of one analysis could not be read.</Notice>;
    else if (sa.kind === "listed" && sb.kind === "listed") body = <ListedCompare a={sa as ListedSummary} b={sb as ListedSummary} />;
    else if (sa.kind === "unlisted" && sb.kind === "unlisted") {
      const ua = sa as UnlistedSummary;
      const ub = sb as UnlistedSummary;
      body =
        ua.research && ub.research ? (
          <UnlistedCompare a={ua} b={ub} />
        ) : (
          <Notice>One of these unlisted analyses was run before valuation and risk were added. Re-run it, then compare again.</Notice>
        );
    } else body = <Notice>These analyses are of different kinds.</Notice>;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <Link href={runA ? `/analyzer/${runA.id}` : "/analyzer"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the analysis
        </Link>
        <div className="mt-4 max-w-2xl">
          <Eyebrow icon={Columns2}>Compare</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight">Side by side</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every block each analysis produced, set against the other. A ▲ marks the stronger reading where a higher or lower number clearly means better. Windows and
            data coverage can differ between the two runs, so treat close differences as noise.
          </p>
        </div>

        {runA && runB ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Side run={runA} tone="a" />
            <Side run={runB} tone="b" />
          </div>
        ) : null}

        {body}
      </main>
      <SiteFooter />
    </div>
  );
}
