import { Globe2 } from "lucide-react";
import { getGlobalIndices } from "@/lib/api/endpoints";
import { DataUnavailable, FreshnessBadge } from "@/components/ui/data-provenance";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

/** Overnight global cues, fetched live on the server. */
export async function GlobalSentiment() {
  const result = await getGlobalIndices();

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Overnight cues
          </h2>
          <p className="mt-3 text-muted-foreground">
            What the rest of the world did before the domestic open.
          </p>
        </div>

        {result.ok ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <Globe2 className="h-4 w-4 text-accent" />
              <div>
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">Breadth</div>
                <div className="font-mono text-sm font-semibold tabular-nums">
                  {result.data.filter((index) => index.changePct > 0).length}/{result.data.length}{" "}
                  advancing
                </div>
              </div>
            </div>
            <FreshnessBadge meta={result.meta} />
          </div>
        ) : null}
      </div>

      {!result.ok ? (
        <div className="mt-8">
          <DataUnavailable message={result.message} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {result.data.map((index) => (
            <li
              key={index.id}
              className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50"
            >
              <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                {index.region}
              </div>
              <h3 className="mt-1 text-sm font-semibold tracking-tight">{index.name}</h3>
              <div className="mt-3 font-mono text-lg font-semibold tabular-nums">
                {formatINR(index.level, 2)}
              </div>
              <div
                className={cn("mt-0.5 font-mono text-xs tabular-nums", deltaColor(index.changePct))}
              >
                {formatPct(index.changePct)}
              </div>

              {/* Centred zero, so direction reads before magnitude */}
              <div className="relative mt-3 h-1 rounded-full bg-muted">
                <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-y-1/2 bg-border" />
                <span
                  className={cn(
                    "absolute top-0 h-full rounded-full",
                    index.changePct >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down",
                  )}
                  style={{ width: `${Math.min(Math.abs(index.changePct) / 2, 1) * 50}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
