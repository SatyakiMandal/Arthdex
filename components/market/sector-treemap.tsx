import Link from "next/link";
import type { ApiPulse } from "@/lib/api/types";
import { cn, formatINR, formatPct } from "@/lib/utils";

type Rect = { x: number; y: number; w: number; h: number };
type Placed<T> = Rect & { item: T };

/**
 * Squarified treemap (Bruls, Huizing and van Wijk): lays out areas proportional to value
 * inside a rectangle, filling rows that keep tiles as close to square as possible.
 */
function squarify<T>(items: { value: number; item: T }[], rect: Rect): Placed<T>[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const queue = [...items].sort((a, b) => b.value - a.value).map((i) => ({ area: i.value * scale, item: i.item }));
  const out: Placed<T>[] = [];
  let free = { ...rect };
  let row: typeof queue = [];

  const worst = (r: typeof queue, side: number) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...r.map((x) => x.area));
    const min = Math.min(...r.map((x) => x.area));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const place = (r: typeof queue) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    if (free.w >= free.h) {
      const width = s / free.h;
      let y = free.y;
      for (const t of r) {
        const h = t.area / width;
        out.push({ x: free.x, y, w: width, h, item: t.item });
        y += h;
      }
      free = { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
    } else {
      const height = s / free.w;
      let x = free.x;
      for (const t of r) {
        const w = t.area / height;
        out.push({ x, y: free.y, w, h: height, item: t.item });
        x += w;
      }
      free = { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
    }
  };

  for (const t of queue) {
    const side = Math.min(free.w, free.h);
    if (!row.length || worst([...row, t], side) <= worst(row, side)) {
      row.push(t);
    } else {
      place(row);
      row = [t];
    }
  }
  if (row.length) place(row);
  return out;
}

/** Day's move as a fill: the theme's up or down colour, stronger with the size of the move (full at 4%). */
function fill(changePct: number): string {
  const strength = Math.min(Math.abs(changePct) / 4, 1);
  if (Math.abs(changePct) < 0.05) return "hsl(var(--muted))";
  return `hsl(var(${changePct > 0 ? "--up" : "--down"}) / ${(0.18 + strength * 0.72).toFixed(2)})`;
}

const W = 1000;
const H = 560;

export function SectorTreemap({ pulse }: { pulse: ApiPulse }) {
  const stocks = pulse.stocks.filter((s) => s.marketCapCr && s.marketCapCr > 0);
  const bySector = new Map<string, typeof stocks>();
  for (const s of stocks) bySector.set(s.industry, [...(bySector.get(s.industry) ?? []), s]);
  const sectorInfo = new Map(pulse.sectors.map((s) => [s.industry, s]));

  const sectors = squarify(
    [...bySector.entries()].map(([industry, list]) => ({ value: list.reduce((a, b) => a + (b.marketCapCr ?? 0), 0), item: { industry, list } })),
    { x: 0, y: 0, w: W, h: H },
  );
  const HEADER = 18;

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-border" style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={`Nifty 500 by sector, tiles sized by market cap and coloured by today's move`}>
        {sectors.map((sec) => {
          const info = sectorInfo.get(sec.item.industry);
          const showHeader = sec.h > HEADER * 2 && sec.w > 60;
          const inner = showHeader ? { x: sec.x, y: sec.y + HEADER, w: sec.w, h: sec.h - HEADER } : sec;
          const tiles = squarify(sec.item.list.map((s) => ({ value: s.marketCapCr ?? 0, item: s })), inner);
          return (
            <div key={sec.item.industry}>
              {showHeader ? (
                <div
                  className="absolute flex items-center justify-between gap-2 overflow-hidden bg-surface px-1.5 text-[11px] leading-none"
                  style={{ left: `${(sec.x / W) * 100}%`, top: `${(sec.y / H) * 100}%`, width: `${(sec.w / W) * 100}%`, height: `${(HEADER / H) * 100}%` }}
                >
                  <span className="truncate font-medium">{sec.item.industry}</span>
                  {info ? <span className={cn("shrink-0 font-mono", info.changePct >= 0 ? "text-up" : "text-down")}>{formatPct(info.changePct, 1)}</span> : null}
                </div>
              ) : null}
              {tiles.map((t) => {
                const big = t.w > 52 && t.h > 30;
                const medium = !big && t.w > 34 && t.h > 16;
                return (
                  <Link
                    key={t.item.symbol}
                    href={`/company/${t.item.symbol}`}
                    title={`${t.item.name} (${t.item.symbol}): ₹${formatINR(t.item.last)}, ${formatPct(t.item.changePct, 2)}, market cap ₹${formatINR(t.item.marketCapCr ?? 0, 0)} Cr`}
                    className="absolute flex flex-col items-center justify-center overflow-hidden border border-background/70 text-center leading-tight text-foreground transition-[filter] hover:brightness-125"
                    style={{
                      left: `${(t.x / W) * 100}%`,
                      top: `${(t.y / H) * 100}%`,
                      width: `${(t.w / W) * 100}%`,
                      height: `${(t.h / H) * 100}%`,
                      background: fill(t.item.changePct),
                    }}
                  >
                    {big || medium ? <span className="max-w-full truncate px-0.5 font-mono text-[10px] font-semibold sm:text-[11px]">{t.item.symbol}</span> : null}
                    {big ? <span className="font-mono text-[10px] sm:text-[11px]">{formatPct(t.item.changePct, 1)}</span> : null}
                    <span className="sr-only">{`${t.item.name}, ${formatPct(t.item.changePct, 2)}`}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {pulse.sectors.map((s) => (
          <li key={s.industry}>{`${s.industry}: ${formatPct(s.changePct, 2)}, ${s.count} companies`}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {stocks.length} companies, tiles sized by market cap. Point at a tile for its name and price; select it for the company page.
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          <span>−4%</span>
          {[-4, -2, -0.5, 0.5, 2, 4].map((v) => (
            <span key={v} className="h-3 w-5" style={{ background: fill(v) }} />
          ))}
          <span>+4%</span>
        </span>
      </div>
    </div>
  );
}
