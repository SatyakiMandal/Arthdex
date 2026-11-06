import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

describe("POST /api/watchlist/snapshot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks cross-origin requests with 403", async () => {
    const req = new Request("http://localhost:3000/api/watchlist/snapshot", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://malicious-site.com",
      },
      body: JSON.stringify({ symbols: ["TCS", "INFY"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.detail).toBe("Cross-origin request forbidden");
  });

  it("blocks malformed origin headers with 403", async () => {
    const req = new Request("http://localhost:3000/api/watchlist/snapshot", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "not-a-valid-url",
      },
      body: JSON.stringify({ symbols: ["TCS"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.detail).toBe("Invalid origin header");
  });

  it("proxies valid same-origin snapshot requests to upstream", async () => {
    const mockPayload = {
      quotes: {
        TCS: { cmp: 3600.0, changePct: 1.2 },
        INFY: { cmp: 1850.0, changePct: -0.4 },
      },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify(mockPayload),
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new Request("http://localhost:3000/api/watchlist/snapshot", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ symbols: ["TCS", "INFY"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const text = await res.text();
    const json = JSON.parse(text);
    expect(json.quotes.TCS.cmp).toBe(3600.0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when backend upstream fetch throws", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", mockFetch);

    const req = new Request("http://localhost:3000/api/watchlist/snapshot", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ symbols: ["RELIANCE"] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.detail).toBe("Cannot reach the data service");
  });
});
