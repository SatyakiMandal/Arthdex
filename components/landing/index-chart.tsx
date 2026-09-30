import type { ApiCandle } from "@/lib/api/types";
import { cn, formatINR, formatPct } from "@/lib/utils";

const W = 720;
const H = 300;
const PAD = 8;

/**
 * Nifty 50 over the last year, drawn from the same candle data the company
 * charts use.
 *
 * This replaced a hand-drawn "factor lattice" ornament. A decorative SVG that
 * represents nothing is the clearest tell that a page was generated rather than
 * designed; a chart of the actual index is real product output and carries
 * information, so it earns its place at the top of the page.
 */
export function IndexChart({
  candles,
  label,
}: {
  candles: ApiCandle[];
  label: string;
}) {
  if (candles.length < 2) return null;

  const closes = candles.map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;

  const x = (index: number) => (index / (candles.length - 1)) * W;
  const y = (value: number) => PAD + (1 - (value - min) / span) * (H - PAD * 2);

  const line = closes.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  const first = closes[0];
  const last = closes[closes.length - 1];
  const changePct = ((last - first) / first) * 100;
  const rising = changePct >= 0;
  const stroke = rising ? "hsl(var(--up))" : "hsl(var(--down))";

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((step) => min + span * step);

  return (
    <figure className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-0.5 font-mono text-2xs text-muted-foreground">
            {candles.length} sessions to {candles[candles.length - 1].date}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold tabular-nums">{formatINR(last, 2)}</div>
          <div className={cn("font-mono text-xs tabular-nums", rising ? "text-up" : "text-down")}>
            {formatPct(changePct, 2)} over the year
          </div>
        </div>
      </figcaption>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full sm:h-64"
          role="img"
          aria-label={`${label} closing level over the past year, ${formatPct(changePct, 2)}`}
        >
          <defs>
            <linearGradient id="index-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          <g stroke="hsl(var(--border))" strokeWidth="1" opacity="0.6">
            {gridValues.map((value) => (
              <line key={value} x1="0" y1={y(value)} x2={W} y2={y(value)} />
            ))}
          </g>

          <path d={area} fill="url(#index-fill)" />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-1">
          {[max, min].map((value) => (
            <span key={value} className="bg-surface pl-1 font-mono text-2xs text-muted-foreground">
              {formatINR(value, 0)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
