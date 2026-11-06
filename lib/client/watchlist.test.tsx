import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWatchlist } from "./watchlist";

describe("lib/client/watchlist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with empty watchlist", () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.items).toEqual([]);
    expect(result.current.ready).toBe(true);
  });

  it("toggles item into watchlist when not present", () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.toggle("listed", "TCS", "Tata Consultancy Services");
    });

    expect(result.current.has("listed", "TCS")).toBe(true);
    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe("Tata Consultancy Services");
  });

  it("toggles item out of watchlist when already present", () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.toggle("listed", "INFY", "Infosys");
    });
    expect(result.current.has("listed", "INFY")).toBe(true);

    act(() => {
      result.current.toggle("listed", "INFY", "Infosys");
    });
    expect(result.current.has("listed", "INFY")).toBe(false);
    expect(result.current.items.length).toBe(0);
  });

  it("removes item explicitly via remove()", () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.toggle("unlisted", "nse-india", "National Stock Exchange");
      result.current.toggle("listed", "SBIN", "State Bank of India");
    });
    expect(result.current.items.length).toBe(2);

    act(() => {
      result.current.remove("unlisted", "nse-india");
    });
    expect(result.current.items.length).toBe(1);
    expect(result.current.has("unlisted", "nse-india")).toBe(false);
    expect(result.current.has("listed", "SBIN")).toBe(true);
  });
});
