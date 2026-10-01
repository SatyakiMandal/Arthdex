"use server";

import { revalidatePath, revalidateTag } from "next/cache";

const BASE_URL = process.env.ARTHDEX_API_URL ?? "http://127.0.0.1:8000";

/** Expire the backend's cache for a page, then drop Next's cached copy of the page's data. */
export async function refreshData(path: string, prefixes: string[], symbol: string | null): Promise<{ ok: boolean; expired: number }> {
  let expired = 0;
  let ok = true;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/cache/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes, symbol }),
      cache: "no-store",
    });
    ok = res.ok;
    if (res.ok) expired = ((await res.json()) as { expired: number }).expired;
  } catch {
    ok = false;
  }
  // Every data fetch is tagged "api". Dropping Next's copies is cheap: pages refill from the backend,
  // which still serves its own cache for anything not expired above.
  revalidateTag("api");
  revalidatePath(path, "layout");
  return { ok, expired };
}
