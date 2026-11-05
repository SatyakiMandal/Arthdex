import Link from "next/link";
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
    <div className="flex shrink-0 items-baseline gap-2 px-4">
      <span className="text-2xs text-muted-foreground">{cell.label}</span>
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
    // Status 0 means the data service never answered: every data page is empty until it does, so say so loudly.
    const down = result.status === 0;
    return (
      <div role="status" className={cn("w-full border-b px-4 py-1.5 text-xs", down ? "border-flat/30 bg-flat/10 text-foreground" : "border-border bg-background text-muted-foreground")}>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-2 sm:px-3">
          <span className="font-medium">{down ? "Data service offline. Live figures will not load." : "Index feed unavailable."}</span>
          <span className="text-muted-foreground">{down ? "Start it with npm run dev, which runs the site and the data service together." : result.message}</span>
          <Link href="/status" className="ml-auto font-medium text-accent underline-offset-4 hover:underline">Data status</Link>
        </div>
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
      <div className="w-full border-b border-border bg-background px-4 py-1.5">
        <span className="font-mono text-2xs text-muted-foreground">No indices returned.</span>
      </div>
    );
  }

  return (
    <div className="group relative w-full overflow-hidden border-b border-border bg-background py-1.5 [mask-image:linear-gradient(90deg,transparent,#000_4rem,#000_calc(100%-4rem),transparent)]">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {cells.map((cell) => (
              <TickerItem key={`${copy}-${cell.key}`} cell={cell} />
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}
