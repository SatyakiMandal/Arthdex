import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { DeskAnalysis } from "@/components/ui/desk-analysis";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import {
  DataUnavailable,
  FreshnessBadge,
  IllustrativeBanner,
  SourceLine,
} from "@/components/ui/data-provenance";
import { getIpoPipeline } from "@/lib/api/endpoints";
import type { ApiIpoIssue } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "IPO Intelligence · Arthdex",
  description: "Live NSE IPO pipeline: ongoing, upcoming, closed and post-listing performance.",
};

interface PageProps {
  searchParams: Promise<{ segment?: string }>;
}

const SEGMENTS = [
  { id: "", label: "All" },
  { id: "mainboard", label: "Mainboard" },
  { id: "sme", label: "SME / MSME" },
];

const STATUS_META: Record<
  string,
  { label: string; blurb: string; tone: "up" | "flat" | "down" | "neutral" }
> = {
  ongoing: { label: "Ongoing", blurb: "Open for subscription now", tone: "up" },
  upcoming: { label: "Upcoming", blurb: "Dates announced, not yet open", tone: "flat" },
  closed: { label: "Closed", blurb: "Bidding shut, awaiting listing", tone: "neutral" },
  listed: { label: "Listed", blurb: "Post-listing performance", tone: "neutral" },
};

const ORDER = ["ongoing", "upcoming", "closed", "listed"];

function IssueRow({ issue }: { issue: ApiIpoIssue }) {
  const banded = issue.priceBandLow !== null && issue.priceBandHigh !== null;
  const isListed = issue.status === "listed";

  return (
    <tr className="border-b border-border/60 last:border-0 cell-glow hover:bg-surface-muted/60 transition-colors">
      <td className="px-2.5 py-1">
        <div className="text-xs font-medium">{issue.name ?? issue.symbol}</div>
        <div className="font-mono text-2xs text-muted-foreground">
          {issue.symbol}
          {issue.issueStartDate ? ` · ${issue.issueStartDate} → ${issue.issueEndDate ?? "?"}` : ""}
        </div>
      </td>
      <td className="px-2.5 py-1 text-right font-mono tabular-nums">
        {banded
          ? `₹${formatINR(issue.priceBandLow!, 0)}–${formatINR(issue.priceBandHigh!, 0)}`
          : "—"}
      </td>
      <td className="px-2.5 py-1 text-right font-mono tabular-nums">
        {issue.subscriptionTimes ? `${issue.subscriptionTimes.toFixed(2)}x` : "—"}
      </td>
      <td className="px-2.5 py-1 text-right font-mono tabular-nums">
        {isListed && issue.listingGainPct !== undefined ? (
          <span className={deltaColor(issue.listingGainPct)}>
            {formatPct(issue.listingGainPct, 1)}
          </span>
        ) : (
          <span className="text-muted-foreground">{issue.listingDate ?? "—"}</span>
        )}
      </td>
      <td className="px-2.5 py-1 text-right font-mono tabular-nums">
        {issue.cmpVsIssuePct !== undefined ? (
          <span className={deltaColor(issue.cmpVsIssuePct)}>
            {formatPct(issue.cmpVsIssuePct, 1)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export default async function IpoPage({ searchParams }: PageProps) {
  const { segment: requested } = await searchParams;
  const segment = SEGMENTS.some((s) => s.id === requested) ? requested : "";

  const result = await getIpoPipeline();

  if (!result.ok) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
          <DataUnavailable title="IPO pipeline unavailable" message={result.message} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const issues = segment
    ? result.data.issues.filter((issue) => issue.segment === segment)
    : result.data.issues;

  const sections = ORDER.map((status) => ({
    status,
    rows: issues.filter((issue) => issue.status === status),
  })).filter((section) => section.rows.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Rocket className="h-4 w-4 text-accent" />
              <span>IPO &amp; Primary Markets Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Live NSE Issue Pipeline, Subscription Status &amp; Reconstructed Post-Listing Alpha
            </span>
          </div>
          <FreshnessBadge meta={result.meta} />
        </div>

        <nav className="mt-2.5 flex flex-wrap gap-1.5">
          {SEGMENTS.map((option) => (
            <a
              key={option.id || "all"}
              href={`/ipo${option.id ? `?segment=${option.id}` : ""}`}
              className={cn(
                "rounded-none border px-3 py-1.5 text-xs transition-colors",
                option.id === segment
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </a>
          ))}
        </nav>

        <dl className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-none border border-border bg-border sm:grid-cols-4">
          {ORDER.map((status) => (
            <div key={status} className="bg-surface px-4 py-2.5">
              <dt className="text-2xs text-muted-foreground">
                {STATUS_META[status].label}
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                {issues.filter((issue) => issue.status === status).length}
              </dd>
            </div>
          ))}
        </dl>

        <DeskAnalysis insights={result.data.insights} title="Primary-market analysis" className="mt-2.5" />

        <div className="mt-2.5 space-y-2.5">
          {sections.map((section) => (
            <DataCard
              key={section.status}
              title={STATUS_META[section.status].label}
              subtitle={STATUS_META[section.status].blurb}
              icon={Rocket}
              badge={<StatusPill label={`${section.rows.length}`} tone={STATUS_META[section.status].tone} />}
            >
              <div className="overflow-x-auto p-2">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-3xs font-mono uppercase tracking-wider text-muted-foreground">
                      <th className="px-2.5 py-1 text-left font-medium">Issue</th>
                      <th className="px-2.5 py-1 text-right font-medium">Price Band</th>
                      <th className="px-2.5 py-1 text-right font-medium">Subscription</th>
                      <th className="px-2.5 py-1 text-right font-medium">
                        {section.status === "listed" ? "Listing Gain" : "Lists"}
                      </th>
                      <th className="px-2.5 py-1 text-right font-medium">CMP vs Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((issue) => (
                      <IssueRow key={`${issue.id}-${issue.symbol}`} issue={issue} />
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <IllustrativeBanner
            title="Grey-market premium is not tracked"
            detail={result.data.unavailable.greyMarketPremium}
          />
          <IllustrativeBanner
            title="Planning / DRHP stage is not tracked"
            detail={result.data.unavailable.planning}
          />
<PageStamp meta={result.meta} />
          <SourceLine meta={result.meta} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
