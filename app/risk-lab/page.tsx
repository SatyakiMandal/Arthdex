import type { Metadata } from "next";
import { QuantRiskLab } from "@/components/quant/quant-risk-lab";

export const metadata: Metadata = {
  title: "Quant Risk Lab & Crisis Stress-Testing (STRS) · Arthdex",
  description:
    "Institutional stress-testing, historical crisis drawdown simulation (2008 GFC, 2020 COVID, 2024 Election), and statutory-deducted backtesting.",
};

export default function RiskLabPage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            QUANT RISK LAB &amp; CRISIS STRESS-TESTING (STRS)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M22 · INSTITUTIONAL RISK ENGINE</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: STRS &lt;GO&gt;</span>
          <span>•</span>
          <span>HISTORICAL TICKS &amp; PARAMETRIC VAR</span>
        </div>
      </div>

      <QuantRiskLab />
    </div>
  );
}
