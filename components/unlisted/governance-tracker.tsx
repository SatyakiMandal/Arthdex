import { AlertOctagon, Eye, FileCheck, ShieldAlert } from "lucide-react";
import type { GovernanceFlag, GovernanceSeverity, UnlistedCompany } from "@/types";
import { governanceVerdict } from "@/lib/illustrative/unlisted";
import { cn } from "@/lib/utils";
import { DataCard, StatusPill } from "@/components/ui/data-card";

const SEVERITY_META: Record<
  GovernanceSeverity,
  { icon: typeof Eye; label: string; card: string; chip: string }
> = {
  "red-flag": {
    icon: AlertOctagon,
    label: "Red Flag",
    card: "border-down/40 bg-down/[0.06]",
    chip: "border-down/40 bg-down/10 text-down",
  },
  watch: {
    icon: Eye,
    label: "Watch",
    card: "border-flat/40 bg-flat/[0.06]",
    chip: "border-flat/40 bg-flat/10 text-flat",
  },
  info: {
    icon: FileCheck,
    label: "Info",
    card: "border-border",
    chip: "border-border bg-surface-muted text-muted-foreground",
  },
};

const CATEGORY_LABEL: Record<GovernanceFlag["category"], string> = {
  "audit-remark": "Audit remark",
  litigation: "Litigation",
  statutory: "Statutory",
  "related-party": "Related party",
};

/** Most severe first, then most recent — the order a risk reviewer reads in. */
const SEVERITY_ORDER: Record<GovernanceSeverity, number> = { "red-flag": 0, watch: 1, info: 2 };

export function GovernanceTracker({ company }: { company: UnlistedCompany }) {
  const verdict = governanceVerdict(company);

  const flags = [...company.governanceFlags].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.reportedOn.localeCompare(a.reportedOn),
  );

  const counts = flags.reduce<Record<GovernanceSeverity, number>>(
    (acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }),
    { "red-flag": 0, watch: 0, info: 0 },
  );

  return (
    <DataCard
      title="Governance &amp; Intelligence"
      subtitle="Parsed audit remarks, litigation and statutory filings"
      icon={ShieldAlert}
      badge={<StatusPill label={verdict.label} tone={verdict.tone} />}
      footnote="Flags are parsed from filed documents, not from management commentary. An 'info' flag is a disclosure that was found and checked, not an absence of risk."
    >
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5">
        {(Object.keys(SEVERITY_META) as GovernanceSeverity[]).map((sev) => (
          <span
            key={sev}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-2xs uppercase tracking-wide",
              SEVERITY_META[sev].chip,
            )}
          >
            {SEVERITY_META[sev].label}
            <span className="tabular-nums">{counts[sev]}</span>
          </span>
        ))}
      </div>

      <ul className="space-y-2.5 p-4">
        {flags.map((flag) => {
          const meta = SEVERITY_META[flag.severity];
          const Icon = meta.icon;
          return (
            <li key={flag.id} className={cn("rounded-lg border p-3", meta.card)}>
              <div className="flex items-start gap-2.5">
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    flag.severity === "red-flag" && "text-down",
                    flag.severity === "watch" && "text-flat",
                    flag.severity === "info" && "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="text-sm font-medium">{flag.title}</h4>
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABEL[flag.category]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">{flag.detail}</p>
                  <p className="mt-1.5 font-mono text-2xs text-muted-foreground/80">
                    {flag.source} · {flag.reportedOn}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </DataCard>
  );
}
