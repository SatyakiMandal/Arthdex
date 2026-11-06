import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStore } from "./use-local-store";

describe("lib/client/use-local-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns initial value when key is not in localStorage", () => {
    const { result } = renderHook(() => useLocalStore("test:count", 42));
    const [value, , ready] = result.current;
    expect(value).toBe(42);
    expect(ready).toBe(true);
  });

  it("updates state and writes to localStorage when setter is called", () => {
    const { result } = renderHook(() => useLocalStore("test:count", 0));
    const [, setVal] = result.current;

    act(() => {
      setVal(100);
    });

    const [value] = result.current;
    expect(value).toBe(100);
    expect(localStorage.getItem("test:count")).toBe("100");
  });

  it("supports functional state updater (prev => next)", () => {
    const { result } = renderHook(() => useLocalStore<string[]>("test:list", ["A"]));
    const [, setVal] = result.current;

    act(() => {
      setVal((prev) => [...prev, "B"]);
    });

    const [value] = result.current;
    expect(value).toEqual(["A", "B"]);
    expect(JSON.parse(localStorage.getItem("test:list") || "[]")).toEqual(["A", "B"]);
  });

  it("handles corrupted JSON gracefully by returning initial value", () => {
    localStorage.setItem("test:corrupted", "{invalid_json:");
    const { result } = renderHook(() => useLocalStore("test:corrupted", { fallback: true }));
    const [value] = result.current;
    expect(value).toEqual({ fallback: true });
  });
});
