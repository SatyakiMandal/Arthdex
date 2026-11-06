import { describe, it, expect } from "vitest";
import { escapeCsvCell, serializeCsv } from "./csv";

describe("lib/client/csv", () => {
  describe("escapeCsvCell", () => {
    it("converts null and undefined to empty strings", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("leaves standard numbers and strings unquoted", () => {
      expect(escapeCsvCell(1234.5)).toBe("1234.5");
      expect(escapeCsvCell("RELIANCE")).toBe("RELIANCE");
    });

    it("escapes cells containing commas, newlines, and quotes", () => {
      expect(escapeCsvCell("State Bank of India, Mumbai")).toBe('"State Bank of India, Mumbai"');
      expect(escapeCsvCell('Quote with "quotes" inside')).toBe('"Quote with ""quotes"" inside"');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("neutralizes CSV formula injection characters (=, +, -, @)", () => {
      expect(escapeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(escapeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(escapeCsvCell("-2+3*cmd|' /C'")).toBe("'-2+3*cmd|' /C'");
      expect(escapeCsvCell("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
      expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    });
  });

  describe("serializeCsv", () => {
    it("serializes headers and rows with CRLF line breaks", () => {
      const header = ["Symbol", "LTP", "Change %"];
      const rows = [
        ["TCS", 3450.25, 1.25],
        ["INFY", 1820.0, -0.45],
      ];
      const result = serializeCsv(header, rows);
      expect(result).toBe("Symbol,LTP,Change %\r\nTCS,3450.25,1.25\r\nINFY,1820,-0.45");
    });

    it("safely serializes complex rows with commas and special characters", () => {
      const header = ["Company", "Notes"];
      const rows = [["Larsen & Toubro, Ltd", 'Includes "defence" projects']];
      const result = serializeCsv(header, rows);
      expect(result).toBe('Company,Notes\r\n"Larsen & Toubro, Ltd","Includes ""defence"" projects"');
    });
  });
});
