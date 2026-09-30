import { Award, Banknote, BadgeCheck, Handshake, Milestone as MilestoneIcon, UserPlus } from "lucide-react";
import type { Milestone, MilestoneKind, UnlistedCompany } from "@/types";
import { formatINR } from "@/lib/utils";
import { DataCard } from "@/components/ui/data-card";

const KIND_META: Record<MilestoneKind, { icon: typeof Award; label: string }> = {
  "client-win": { icon: Handshake, label: "Client win" },
  "key-hire": { icon: UserPlus, label: "Key hire" },
  "order-book": { icon: Award, label: "Order book" },
  funding: { icon: Banknote, label: "Funding" },
  certification: { icon: BadgeCheck, label: "Certification" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function MilestoneTimeline({ company }: { company: UnlistedCompany }) {
  // Newest first — the most recent catalyst is the one that moves the mark
  const milestones: Milestone[] = [...company.milestones].sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn),
  );

  const bookedValue = milestones.reduce((s, m) => s + (m.valueCr ?? 0), 0);

  return (
    <DataCard
      title="Milestones &amp; Catalysts"
      subtitle="Order wins, client references, hires and certifications"
      icon={MilestoneIcon}
      badge={
        bookedValue > 0 ? (
          <div className="text-right">
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              Value disclosed
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums text-accent">
              ₹{formatINR(bookedValue, 0)} Cr
            </div>
          </div>
        ) : undefined
      }
    >
      <ol className="relative px-4 py-4">
        {/* Spine — inset so it passes through the centre of each marker */}
        <span aria-hidden className="absolute bottom-6 left-[1.4375rem] top-7 w-px bg-border" />

        {milestones.map((m) => {
          const meta = KIND_META[m.kind];
          const Icon = meta.icon;
          return (
            <li key={m.id} className="relative flex gap-3 pb-5 last:pb-0">
              <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-accent">
                <Icon className="h-3 w-3" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                    {formatDate(m.occurredOn)}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                  {m.valueCr ? (
                    <span className="font-mono text-2xs font-medium text-accent">
                      ₹{formatINR(m.valueCr, 0)} Cr
                    </span>
                  ) : null}
                </div>
                <h4 className="mt-1 text-sm font-medium">{m.title}</h4>
                <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{m.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </DataCard>
  );
}
