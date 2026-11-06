import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as endpoints from "@/lib/api/endpoints";

vi.mock("@/lib/api/endpoints", () => ({
  searchCompanies: vi.fn(),
}));

describe("app/api/search/route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty results immediately for blank or whitespace query", async () => {
    const req = new Request("http://localhost:3000/api/search?q=");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(endpoints.searchCompanies).not.toHaveBeenCalled();
  });

  it("returns search results when upstream succeeds", async () => {
    const mockCompanies = [
      { symbol: "TCS", name: "Tata Consultancy Services" },
      { symbol: "TATACHEM", name: "Tata Chemicals Ltd" },
    ];

    vi.mocked(endpoints.searchCompanies).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: mockCompanies,
      meta: { source: "NSE", delayedMinutes: 0 },
    } as any);

    const req = new Request("http://localhost:3000/api/search?q=tata");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toEqual(mockCompanies);
    expect(endpoints.searchCompanies).toHaveBeenCalledWith("tata", 10);
  });

  it("returns 503 error when upstream data service is unavailable", async () => {
    vi.mocked(endpoints.searchCompanies).mockResolvedValueOnce(null as any);

    const req = new Request("http://localhost:3000/api/search?q=hdfc");
    const res = await GET(req);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.error).toContain("unavailable");
  });
});
