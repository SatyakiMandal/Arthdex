import type { Metadata } from "next";

import { QuantRiskLab } from "@/components/quant/quant-risk-lab";
import { getCrisisScenarios } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Risk lab · Arthdex",
  description: "Replay past market crises on a portfolio using each holding's recorded prices, test a chosen index move, and backtest a moving-average rule after charges.",
};

export default async function RiskLabPage() {
  const scenarios = await getCrisisScenarios();
  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">Risk lab</h1>
        <span className="font-mono text-3xs text-muted-foreground">Crisis replay • index move • benchmark regression • backtest</span>
      </div>
      <QuantRiskLab scenarios={scenarios.ok ? scenarios.data : []} scenariosError={scenarios.ok ? null : scenarios.message} />
    </div>
  );
}
