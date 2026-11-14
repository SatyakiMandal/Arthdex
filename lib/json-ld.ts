const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serialises structured data for an inline <script type="application/ld+json">.
 *
 * JSON.stringify leaves "<" as is, so a scraped company name or summary holding
 * "</script>" would close the tag and run as markup. Escaping the angle brackets,
 * the ampersand and the two line separators keeps the payload inert and still valid JSON.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}
