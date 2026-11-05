import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Columns2, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
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
    <p role="alert" className="mt-4 rounded-none border border-flat/40 bg-flat/[0.07] px-3 py-2 font-mono text-2xs">
      {children}
    </p>
  );
}

function Side({ run, tone }: { run: AnalyzerRun; tone: "a" | "b" }) {
  return (
    <div className={`min-w-0 rounded-none border bg-surface p-2.5 font-mono ${tone === "a" ? "border-accent/40" : "border-gold/40"}`}>
      <p className={`text-3xs uppercase tracking-wider font-bold ${tone === "a" ? "text-accent" : "text-gold"}`}>{tone === "a" ? "Company A" : "Company B"}</p>
      <h2 className="mt-0.5 truncate text-base font-bold tracking-tight text-foreground">{run.company}</h2>
      <p className="font-mono text-3xs text-muted-foreground">
        {run.ticker ?? "Unlisted"} · {run.start} to {run.end}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-2xs">
        <Link href={`/analyzer/${run.id}`} className="inline-flex items-center gap-1 text-accent hover:underline font-bold">
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
      <main id="main" className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <Link href={runA ? `/analyzer/${runA.id}` : "/analyzer"} className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
            <span className="text-border">|</span>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Columns2 className="h-4 w-4 text-accent" />
              <span>Comparative Event Impact Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Side-by-Side Abnormal Return Studies, Valuation Factors &amp; Risk Metrics
            </span>
          </div>
        </div>

        {runA && runB ? (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <Side run={runA} tone="a" />
            <Side run={runB} tone="b" />
          </div>
        ) : null}

        <div className="mt-3">
          {body}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
