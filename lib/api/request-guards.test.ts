import { describe, expect, it } from "vitest";

import { jsonLdScript } from "@/lib/json-ld";

import { isCrossSiteRequest, isValidSymbol, rateLimit, rateLimitKey } from "./request-guards";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/x", { method: "POST", headers });
}

describe("isCrossSiteRequest", () => {
  it("passes same-origin and header-less requests", () => {
    expect(isCrossSiteRequest(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(false);
    expect(isCrossSiteRequest(req({ host: "localhost:3000" }))).toBe(false);
  });

  it("blocks another origin, a malformed origin and a sandboxed frame", () => {
    expect(isCrossSiteRequest(req({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteRequest(req({ host: "localhost:3000", origin: "not-a-url" }))).toBe(true);
    expect(isCrossSiteRequest(req({ host: "localhost:3000", origin: "null" }))).toBe(true);
  });

  it("blocks on Sec-Fetch-Site even without an Origin header", () => {
    expect(isCrossSiteRequest(req({ host: "localhost:3000", "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(req({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(false);
  });
});

describe("isValidSymbol", () => {
  it("accepts tickers and rejects everything else", () => {
    expect(isValidSymbol("M&M")).toBe(true);
    expect(isValidSymbol("BAJAJ-AUTO")).toBe(true);
    expect(isValidSymbol("../etc/passwd")).toBe(false);
    expect(isValidSymbol("</script>")).toBe(false);
    expect(isValidSymbol("A".repeat(21))).toBe(false);
    expect(isValidSymbol(null)).toBe(false);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit, then reports a wait", () => {
    const r = req({ "x-forwarded-for": "198.51.100.7" });
    expect(rateLimit("t1", r, 2, 60_000)).toBe(0);
    expect(rateLimit("t1", r, 2, 60_000)).toBe(0);
    expect(rateLimit("t1", r, 2, 60_000)).toBeGreaterThan(0);
    // another caller has its own bucket
    expect(rateLimit("t1", req({ "x-forwarded-for": "198.51.100.8" }), 2, 60_000)).toBe(0);
  });

  it("starts a new window once the old one ends", async () => {
    expect(rateLimitKey("t2", 1, 5)).toBe(0);
    expect(rateLimitKey("t2", 1, 5)).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(rateLimitKey("t2", 1, 5)).toBe(0);
  });
});

describe("jsonLdScript", () => {
  it("cannot close the script tag and still parses to the same data", () => {
    const data = { name: "Evil </script><script>alert(1)</script> & Co" };
    const out = jsonLdScript(data);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out)).toEqual(data);
  });
});
