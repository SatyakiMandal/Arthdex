import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/api/endpoints", () => ({
  getFnoBan: vi.fn(),
}));

import { getFnoBan } from "@/lib/api/endpoints";

describe("GET /api/derivatives/fno-ban", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ban list successfully when upstream responds ok", async () => {
    vi.mocked(getFnoBan).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        bannedSymbols: ["SAIL", "IDEA", "SUNTV"],
        totalBanned: 3,
        asOf: "2025-02-01",
      },
      meta: { cached: true },
    } as any);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.bannedSymbols).toEqual(["SAIL", "IDEA", "SUNTV"]);
    expect(json.meta.cached).toBe(true);
  });

  it("propagates error when upstream getFnoBan fails with non-ok response", async () => {
    vi.mocked(getFnoBan).mockResolvedValueOnce({
      ok: false,
      status: 502,
      message: "NSE circulars upstream unavailable",
    } as any);

    const res = await GET();
    expect(res.status).toBe(502);

    const json = await res.json();
    expect(json.error).toBe("NSE circulars upstream unavailable");
  });

  it("catches uncaught exceptions and returns 500 status", async () => {
    vi.mocked(getFnoBan).mockRejectedValueOnce(new Error("Connection reset by peer"));

    const res = await GET();
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("Connection reset by peer");
  });
});
