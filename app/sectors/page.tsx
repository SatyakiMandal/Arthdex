import type { Metadata } from "next";
import { SectorKpiDesk } from "@/components/sectors/sector-kpi-desk";

export const metadata: Metadata = {
  title: "Sector Operating KPIs Dashboard (SKPI) · Arthdex",
  description:
    "Real-time Indian industry operating metrics: SIAM automotive wholesale & VAHAN retail, RBI sectoral credit deployment, CEA power demand, DGCA aviation passenger loads, and TRAI telecom subscribers.",
};

export default function SectorsPage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            SECTOR OPERATING KPIS DASHBOARD (SKPI)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M19 · REAL-ECONOMY OPERATING RADAR</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: SKPI &lt;GO&gt;</span>
          <span>•</span>
          <span>SIAM • VAHAN • RBI • CEA • DGCA • TRAI</span>
        </div>
      </div>

      <SectorKpiDesk />
    </div>
  );
}
