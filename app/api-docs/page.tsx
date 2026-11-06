import type { Metadata } from "next";
import { ApiDocsView } from "@/components/api-docs/api-docs-view";

export const metadata: Metadata = {
  title: "Excel Add-In & Public API Gateway (XLS, API) · Arthdex",
  description:
    "Direct spreadsheet formulas for Excel (=WEBSERVICE) and Google Sheets (=IMPORTDATA), plus developer REST endpoints for Indian financial market analytics.",
};

export default function ApiDocsPage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-4">
      {/* Title Header */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            EXCEL FORMULA CONNECTOR &amp; PUBLIC API GATEWAY (XLS, API)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M26 · INTEGRATION &amp; DATA SERVICES</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: XLS &lt;GO&gt; • API &lt;GO&gt;</span>
          <span>•</span>
          <span>=WEBSERVICE() • CSV STREAMS • PYTHON PANDAS</span>
        </div>
      </div>

      <ApiDocsView />
    </div>
  );
}
