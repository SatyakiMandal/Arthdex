"use client";

export type CsvCell = string | number | null | undefined;

function escape(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  let text = String(cell);
  // Third-party text (client names, headlines) can start with = + - or @, which a spreadsheet would run as a formula
  if (typeof cell === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Download rows as a UTF-8 CSV. The BOM makes Excel read the rupee sign and Indian names correctly. */
export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  const body = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
