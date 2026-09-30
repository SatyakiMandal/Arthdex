import type { Metadata } from "next";
import { ReturnForecasts } from "@/components/quant/return-forecasts";
import { VolatilityEnsemble } from "@/components/quant/volatility-ensemble";
import { RiskSuite } from "@/components/quant/risk-suite";
import { MicrostructureCard, RegimeCard } from "@/components/quant/regime-card";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getQuant } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Quant Engine | Arthdex` };
}

export default async function QuantPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const quant = await getQuant(upper);

  if (!quant) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <DataUnavailable
          title="Quant engine unavailable"
          message={`No model output could be produced for ${upper}. This usually means the data service is not running, or the ticker has too little price history to fit a model.`}
        />
      </div>
    );
  }

  const { volatility, var: varSuite, merton, regime, forecasts, microstructure } = quant.data;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <ReturnForecasts forecasts={forecasts} />
        <VolatilityEnsemble volatility={volatility} />
        <RiskSuite merton={merton} varSuite={varSuite} />
        <div className="grid gap-4">
          <RegimeCard regime={regime} />
          <MicrostructureCard micro={microstructure} />
        </div>
      </div>

      <div className="mt-4">
        <SourceLine meta={quant.meta} />
      </div>
    </div>
  );
}
