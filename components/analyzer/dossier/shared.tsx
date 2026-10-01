import { StatusPill } from "@/components/ui/data-card";
import { cn, formatINR, formatPct } from "@/lib/utils";

export const dash = "—";
export const num = (v: number | null | undefined, d = 2) => (v == null ? dash : v.toFixed(d));
export const pct = (v: number | null | undefined, d = 2) => (v == null ? dash : formatPct(v, d));
/** The engine reports returns / volatilities as fractions in most blocks. */
export const frac = (v: number | null | undefined, d = 2) => (v == null ? dash : `${(v * 100).toFixed(d)}%`);
export const fracSigned = (v: number | null | undefined, d = 2) => (v == null ? dash : formatPct(v * 100, d));
export const inr = (v: number | null | undefined, d = 2) => (v == null ? dash : `₹${formatINR(v, d)}`);
export const str = (v: unknown) => (typeof v === "string" && v ? v : dash);

export type Tone = "up" | "down" | "flat";

export function stanceTone(stance: string | null | undefined): Tone {
  const s = (stance ?? "").toLowerCase();
  if (s.includes("bull") || s.includes("buy") || s.includes("accumulate") || s.includes("undervalu") || s.includes("discount")) return "up";
  if (s.includes("bear") || s.includes("sell") || s.includes("reduce") || s.includes("overvalu") || s.includes("premium")) return "down";
  return "flat";
}

export function Stat({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: string; hint?: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm", tone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4 2xl:grid-cols-6" }[cols];
  return <div className={cn("grid grid-cols-2 gap-x-3 gap-y-2.5 p-3", c)}>{children}</div>;
}

export function Pill({ label, tone, hint }: { label: string; tone: Tone; hint?: string }) {
  return <StatusPill label={label} tone={tone} hint={hint} />;
}

/** Horizontal-scroll wrapper + consistent table chrome. */
export function Table({
  head,
  children,
  min = 480,
  className,
}: {
  head: (string | { label: string; right?: boolean })[];
  children: React.ReactNode;
  min?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            {head.map((h, i) => {
              const label = typeof h === "string" ? h : h.label;
              const right = typeof h !== "string" && h.right;
              return (
                <th key={i} className={cn("px-4 py-2 font-medium", right && "text-right")}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, right, mono, className }: { children: React.ReactNode; right?: boolean; mono?: boolean; className?: string }) => (
  <td className={cn("px-4 py-2 align-top", right && "text-right", (right || mono) && "whitespace-nowrap font-mono", className)}>{children}</td>
);

export function Bullets({ items }: { items: (string | null | undefined)[] }) {
  const list = items.filter((x): x is string => !!x);
  if (list.length === 0) return null;
  return (
    <ul className="space-y-1.5 p-3 text-[0.8125rem] text-muted-foreground">
      {list.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-[0.8125rem] text-muted-foreground">{children}</p>;
}
