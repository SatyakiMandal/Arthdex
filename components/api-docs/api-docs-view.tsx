"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Code,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ShieldAlert,
  Zap,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ApiDocsView() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<"EXCEL" | "SHEETS" | "PYTHON" | "CURL">("EXCEL");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      {/* Title & Guidance Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface-muted/30 p-2.5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-accent" />
          <span className="font-bold uppercase text-foreground">
            PUBLIC API GATEWAY &amp; LIVE SPREADSHEET FORMULA CONNECTOR (M26)
          </span>
        </div>
        <div className="flex items-center gap-3 text-3xs text-muted-foreground">
          <span>HIGH-THROUGHPUT REST • CSV STREAMS • ZERO DELAY FORMULAS</span>
          <span className="text-accent font-bold">RATE LIMIT: 60 REQ/MIN (FREE)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface-muted/20">
        {[
          { id: "EXCEL", label: "MICROSOFT EXCEL (=WEBSERVICE)" },
          { id: "SHEETS", label: "GOOGLE SHEETS (=IMPORTDATA)" },
          { id: "PYTHON", label: "PYTHON (REQUESTS / PANDAS)" },
          { id: "CURL", label: "CURL / REST ENDPOINTS" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedLang(tab.id as any)}
            className={cn(
              "px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
              selectedLang === tab.id
                ? "border-accent text-accent bg-surface"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* EXCEL CODE SNIPPET */}
      {selectedLang === "EXCEL" && (
        <div className="border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-2xs uppercase text-foreground">
              Direct In-Cell Formula (No Add-In or Plugin Required)
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  '=VALUE(WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=PRICE"))',
                  "excel-formula"
                )
              }
              className="flex items-center gap-1 text-3xs text-accent hover:underline uppercase font-bold"
            >
              {copiedKey === "excel-formula" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKey === "excel-formula" ? "COPIED" : "COPY FORMULA"}</span>
            </button>
          </div>

          <pre className="p-3 bg-surface-muted border border-border/80 text-foreground overflow-x-auto text-2xs font-mono">
            <code>
              {`// Live Stock Price for Reliance in Cell A1:
=VALUE(WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=PRICE"))

// Live Trailing P/E Multiple:
=VALUE(WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=TCS&field=PE"))

// Live Market Cap in ₹ Crores:
=VALUE(WEBSERVICE("https://arthdex.com/api/v1/xls/quote?symbol=HDFCBANK&field=MCAP"))`}
            </code>
          </pre>

          <p className="text-3xs text-muted-foreground leading-relaxed">
            Uses native Excel <code className="text-foreground font-bold">=WEBSERVICE()</code>. Updates automatically when you press <kbd>F9</kbd> (Calculate Now) in your workbook.
          </p>
        </div>
      )}

      {/* GOOGLE SHEETS */}
      {selectedLang === "SHEETS" && (
        <div className="border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-2xs uppercase text-foreground">
              Google Sheets Live CSV Array Formula
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  '=IMPORTDATA("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=ALL_CSV")',
                  "sheets-formula"
                )
              }
              className="flex items-center gap-1 text-3xs text-accent hover:underline uppercase font-bold"
            >
              {copiedKey === "sheets-formula" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKey === "sheets-formula" ? "COPIED" : "COPY FORMULA"}</span>
            </button>
          </div>

          <pre className="p-3 bg-surface-muted border border-border/80 text-foreground overflow-x-auto text-2xs font-mono">
            <code>
              {`// Imports complete header & financial row across 9 columns:
=IMPORTDATA("https://arthdex.com/api/v1/xls/quote?symbol=RELIANCE&field=ALL_CSV")

// Imports 30-Day Daily OHLCV Table into a new sheet:
=IMPORTDATA("https://arthdex.com/api/v1/xls/hist?symbol=M&M&days=30")`}
            </code>
          </pre>
        </div>
      )}

      {/* PYTHON SCRIPT */}
      {selectedLang === "PYTHON" && (
        <div className="border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-2xs uppercase text-foreground">
              Python 3 / Pandas Integration
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  `import pandas as pd\ndf = pd.read_csv("https://arthdex.com/api/v1/xls/hist?symbol=RELIANCE&days=60")\nprint(df.tail())`,
                  "py-code"
                )
              }
              className="flex items-center gap-1 text-3xs text-accent hover:underline uppercase font-bold"
            >
              {copiedKey === "py-code" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedKey === "py-code" ? "COPIED" : "COPY CODE"}</span>
            </button>
          </div>

          <pre className="p-3 bg-surface-muted border border-border/80 text-foreground overflow-x-auto text-2xs font-mono">
            <code>
              {`import pandas as pd

# Load historical daily candles directly into a DataFrame
df = pd.read_csv("https://arthdex.com/api/v1/xls/hist?symbol=RELIANCE&days=60")
df['DATE'] = pd.to_datetime(df['DATE'])
df.set_index('DATE', inplace=True)

print("Recent Reliance OHLCV:")
print(df.tail())`}
            </code>
          </pre>
        </div>
      )}

      {/* CURL / REST ENDPOINTS */}
      {selectedLang === "CURL" && (
        <div className="border border-border bg-surface p-4 space-y-3">
          <span className="font-bold text-2xs uppercase text-foreground">Core REST Endpoints</span>
          <div className="space-y-2 text-2xs">
            {[
              { method: "GET", path: "/api/v1/xls/quote?symbol=TCS&field=PRICE", desc: "Current traded price in plain text" },
              { method: "GET", path: "/api/v1/xls/quote?symbol=TCS&field=PE", desc: "Trailing price-to-earnings ratio" },
              { method: "GET", path: "/api/v1/xls/quote?symbol=TCS&field=ALL_CSV", desc: "Full 9-field CSV row with header" },
              { method: "GET", path: "/api/v1/xls/hist?symbol=TCS&days=90", desc: "Daily OHLCV time-series in CSV format" },
            ].map((ep) => (
              <div key={ep.path} className="p-2 border border-border bg-surface-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-accent/20 text-accent font-bold text-3xs border border-accent/40">
                    {ep.method}
                  </span>
                  <code className="text-foreground font-bold">{ep.path}</code>
                </div>
                <span className="text-3xs text-muted-foreground">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
