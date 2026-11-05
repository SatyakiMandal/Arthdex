import Link from "next/link";
import type { ApiPeBand, ApiPeers } from "@/lib/api/types";
import { cn, formatINR } from "@/lib/utils";

const COLUMNS: { key: keyof ApiPeers["peers"][number]; label: string; digits: number; suffix?: string }[] = [
  { key: "marketCapCr", label: "Market cap (₹ Cr)", digits: 0 },
  { key: "pe", label: "P/E", digits: 1 },
  { key: "rocePct", label: "ROCE", digits: 1, suffix: "%" },
  { key: "dividendYieldPct", label: "Div. yield", digits: 2, suffix: "%" },
  { key: "salesGrowthQtrPct", label: "Sales growth, qtr", digits: 1, suffix: "%" },
  { key: "profitGrowthQtrPct", label: "Profit growth, qtr", digits: 1, suffix: "%" },
];

const fmt = (v: number | null | undefined, digits: number, suffix = "") =>
  v == null ? "—" : `${formatINR(v, digits)}${suffix}`;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** The table holds the largest peers by market cap, with the company added if it is not among them. */
function largestText(peers: ApiPeers, symbol: string) {
  const others = peers.peers.filter((p) => p.symbol !== symbol).length;
  const added = peers.peers.at(-1)?.symbol === symbol && (peers.ranks.marketCapCr?.position ?? 0) === peers.peers.length;
  return added && (peers.ranks.marketCapCr?.position ?? 0) > others
    ? `The ${others} largest are shown, with this company added below them.`
    : `The ${peers.peers.length} largest are shown, this company among them.`;
}

/** Plain sentences for where the company stands in its industry on each measure. */
function standings(peers: ApiPeers): string[] {
  const words: Record<string, [string, string]> = {
    rocePct: ["return on capital", "highest"],
    pe: ["P/E", "highest"],
    dividendYieldPct: ["dividend yield", "highest"],
    salesGrowthQtrPct: ["sales growth last quarter", "fastest"],
  };
  return Object.entries(words).flatMap(([key, [what, top]]) => {
    const r = peers.ranks[key];
    if (!r) return [];
    if (r.position === 1) return [`the ${top} ${what}`];
    if (r.position === r.of) return [`the ${key === "pe" ? "lowest" : top === "fastest" ? "slowest" : "lowest"} ${what}`];
    return [`the ${ordinal(r.position)} ${top} ${what}`];
  });
}

/**
 * Where today's P/E sits in the company's own five-year range: a hairline from the lowest
 * to the highest weekly P/E, the middle half shaded, the median and today marked.
 */
export function PeBandRail({ band }: { band: ApiPeBand }) {
  const { min, p25, median, p75, max } = band.stats;
  const span = max - min || 1;
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / span) * 100))}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">P/E against its own five years</p>
        <p className="text-xs text-muted-foreground">{band.percentile.toFixed(0)}th percentile</p>
      </div>
      <div className="relative mt-5 h-px bg-border" aria-hidden>
        <span className="absolute top-1/2 h-2 -translate-y-1/2 bg-foreground/15" style={{ left: at(p25), width: `calc(${at(p75)} - ${at(p25)})` }} />
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-muted-foreground" style={{ left: at(median) }} />
        <span className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gold" style={{ left: at(band.current) }} />
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span>{min.toFixed(1)}</span>
        <span>median {median.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        At <span className="font-mono text-foreground">{band.current.toFixed(1)}</span> times {band.epsYear} earnings, the stock is
        {band.current < p25 ? " cheaper than in most of" : band.current > p75 ? " dearer than in most of" : " within the usual range of"} the last five years. The shaded
        middle half runs from {p25.toFixed(1)} to {p75.toFixed(1)}.
      </p>
    </div>
  );
}

export function PeersPanel({ peers, symbol }: { peers: ApiPeers; symbol: string }) {
  const said = standings(peers);
  return (
    <div>
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        {peers.classification.industry}: {peers.industrySize} listed companies. {largestText(peers, symbol)}
        {said.length ? ` Among them it has ${said.slice(0, -1).join(", ")}${said.length > 1 ? " and " : ""}${said.at(-1)}.` : ""}
      </p>
      <div className="mt-2.5 overflow-x-auto border border-border/70">
        <table className="w-full min-w-[760px] border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-2.5 py-1 text-left font-medium text-3xs uppercase tracking-wider text-muted-foreground">Company</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-2.5 py-1 text-right font-medium text-3xs uppercase tracking-wider text-muted-foreground">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {peers.peers.map((row) => {
              const self = row.symbol === symbol;
              return (
                <tr key={row.symbol} className={cn("border-b border-border/60 hover:bg-surface-muted/80 transition-colors", self && "bg-surface-muted")}>
                  <th scope="row" className="px-2.5 py-1 text-left font-normal cell-glow">
                    <span className="inline-flex items-center gap-2">
                      {self ? <span className="h-3 w-[2px] bg-gold" aria-hidden /> : null}
                      {self ? (
                        <span className="font-medium">{row.name}</span>
                      ) : (
                        <Link href={`/company/${row.symbol}`} className="underline decoration-border underline-offset-4 hover:decoration-gold">
                          {row.name}
                        </Link>
                      )}
                      <span className="font-mono text-xs text-muted-foreground">{row.symbol}</span>
                    </span>
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-2.5 py-1 text-right font-mono tabular-nums cell-glow">
                      {fmt(row[c.key] as number | null | undefined, c.digits, c.suffix)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="text-muted-foreground">
              <th scope="row" className="px-2.5 py-1 text-left text-3xs font-medium uppercase tracking-wider text-muted-foreground">Median of peers</th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="px-2.5 py-1 text-right font-mono tabular-nums text-xs cell-glow text-muted-foreground">
                  {fmt(peers.medians[c.key as string], c.digits, c.suffix)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {peers.vetting.vetted
          ? "Peer figures are screener.in's; its row for this company matches Arthdex's vetted price and market cap, so its figures for the others are taken as current."
          : "Peer figures are screener.in's and could not be checked against Arthdex's own: treat them as indicative."}
      </p>
    </div>
  );
}
