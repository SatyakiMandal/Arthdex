import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSnapshot, type Target } from "./snapshot";

describe("lib/client/snapshot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty result immediately without fetching if target list is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await fetchSnapshot([]);
    expect(result).toEqual({ listed: [], unlisted: [], unlistedReady: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deduplicates listed and unlisted targets and posts to /api/watchlist/snapshot", async () => {
    const targets: Target[] = [
      { kind: "listed", id: "TCS" },
      { kind: "listed", id: "TCS" },
      { kind: "unlisted", id: "nse-india" },
    ];

    const mockResponse = {
      data: {
        listed: [{ id: "TCS", price: 3500, changePct: 1.5, previousClose: 3450 }],
        unlisted: [{ id: "nse-india", price: 4200, name: "National Stock Exchange", sector: "Financial Services" }],
        unlistedReady: true,
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchSnapshot(targets);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/watchlist/snapshot",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ listed: ["TCS"], unlisted: ["nse-india"] }),
      }),
    );
    expect(result).toEqual(mockResponse.data);
  });

  it("returns null when network call fails or server returns error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchSnapshot([{ kind: "listed", id: "TCS" }]);
    expect(result).toBeNull();
  });

  it("returns null gracefully when network throws an exception", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failed"));

    const result = await fetchSnapshot([{ kind: "listed", id: "TCS" }]);
    expect(result).toBeNull();
  });
});
