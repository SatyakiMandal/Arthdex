"use client";

import { Download } from "lucide-react";
import { downloadCsv, type CsvCell } from "@/lib/client/csv";
import { cn } from "@/lib/utils";

/** Small button that downloads the rows it is given as a CSV file. */
export function ExportCsv({
  filename,
  header,
  rows,
  className,
}: {
  filename: string;
  header: string[];
  rows: CsvCell[][];
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(`${filename}-${new Date().toISOString().slice(0, 10)}`, header, rows)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 text-xs font-medium text-muted-foreground transition-all hover:border-accent/50 hover:text-foreground active:scale-[0.98] disabled:opacity-40",
        className,
      )}
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
  );
}
