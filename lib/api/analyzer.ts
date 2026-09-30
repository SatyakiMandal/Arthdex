import "server-only";

import type { AnalyzerRun } from "@/types/analyzer";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/** Analyzer routes are not enveloped: runs are stateful, so there is no cache age to report. */
export async function analyzerGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/analyzer${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const listRuns = (origin?: "run" | "sample") =>
  analyzerGet<{ runs: AnalyzerRun[] }>(`/runs${origin ? `?origin=${origin}` : ""}`);

export const getRun = (id: string) => analyzerGet<AnalyzerRun>(`/runs/${encodeURIComponent(id)}`);

export const analyzerBaseUrl = BASE_URL;
