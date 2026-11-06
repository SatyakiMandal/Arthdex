import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

describe("app/api/quote/route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when symbol query parameter is missing or empty", async () => {
    const req = new Request("http://localhost:3000/api/quote");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("valid ticker symbol is required");
  });

  it("returns 400 when symbol contains invalid characters (injection / malformed)", async () => {
    const req = new Request("http://localhost:3000/api/quote?symbol=<script>alert(1)</script>");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("proxies upstream quote correctly and sets zero-cache headers", async () => {
    const mockEnvelope = {
      data: { symbol: "TCS", cmp: 3500.5, change: { absolute: 25.5, percent: 0.73 } },
      meta: { source: "NSE", delayedMinutes: 0 },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEnvelope,
    } as Response);

    const req = new Request("http://localhost:3000/api/quote?symbol=TCS");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.cmp).toBe(3500.5);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns 503 status code when upstream fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const req = new Request("http://localhost:3000/api/quote?symbol=INFY");
    const res = await GET(req);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Connection refused");
  });
});
