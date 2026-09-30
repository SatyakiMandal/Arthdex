import { getIndices } from "@/lib/api/endpoints";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

interface TickerCell {
  key: string;
  label: string;
  value: string;
  changePct: number;
}

function TickerItem({ cell }: { cell: TickerCell }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2 border-r border-border/50 px-4">
      <span className="text-2xs uppercase tracking-wide text-muted-foreground">{cell.label}</span>
      <span className="font-mono text-xs font-medium tabular-nums">{cell.value}</span>
      <span className={cn("font-mono text-2xs font-medium", deltaColor(cell.changePct))}>
        {formatPct(cell.changePct)}
      </span>
    </div>
  );
}

/**
 * Live NSE index bar.
 *
 * A server component so the indices are fetched on the server and revalidated
 * rather than hammering the data service from every open tab.
 */
export async function MarketTicker() {
  const result = await getIndices();

  if (!result.ok) {
    return (
      <div className="w-full border-b border-border bg-surface-muted/95 px-4 py-1.5">
        <span className="font-mono text-2xs text-muted-foreground">
          Index feed unavailable. {result.message}
        </span>
      </div>
    );
  }

  const cells: TickerCell[] = result.data.map((index) => ({
    key: index.id,
    label: index.name,
    value: formatINR(index.level, 2),
    changePct: index.change.percent,
  }));

  if (cells.length === 0) {
    return (
      <div className="w-full border-b border-border bg-surface-muted/95 px-4 py-1.5">
        <span className="font-mono text-2xs text-muted-foreground">No indices returned.</span>
      </div>
    );
  }

  return (
    <div className="group relative w-full overflow-hidden border-b border-border bg-surface-muted/95 py-1.5 backdrop-blur-xl">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {cells.map((cell) => (
              <TickerItem key={`${copy}-${cell.key}`} cell={cell} />
            ))}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-surface-muted to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-surface-muted to-transparent" />
    </div>
  );
}
