"use client";

/** Cell data type supported in CSV tables */
export type CsvCell = string | number | null | undefined;

/**
 * Escapes a single CSV cell value:
 * - Null or undefined converts to empty string
 * - Defends against CSV Formula Injection (DDE injection) if text begins with =, +, -, @, \t, or \r
 * - Wraps in double quotes and escapes internal quotes if comma, newline, carriage return, or double quote is present
 */
export function escapeCsvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  let text = String(cell);
  // Defend against spreadsheet formula injection attacks
  if (typeof cell === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Serializes rows into a UTF-8 CSV string with CRLF row breaks.
 */
export function serializeCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
}

/**
 * Downloads tabular data as a UTF-8 CSV file in the browser.
 * Includes UTF-8 Byte Order Mark (BOM) `\uFEFF` so Microsoft Excel renders
 * Indian Rupee symbols (₹) and non-ASCII company names correctly.
 *
 * @param filename File name (appends .csv if omitted)
 * @param header Array of column headers
 * @param rows 2D array of rows
 */
export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  const body = serializeCsv(header, rows);
  const blob = new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
