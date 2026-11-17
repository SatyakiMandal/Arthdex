"use server";

import { cookies } from "next/headers";
import { EXCHANGE_VIEW_COOKIE, parseExchangeView } from "@/lib/exchange-view";

/** Remember the reader's exchange preference; setting a cookie re-renders the current page. */
export async function setExchangeView(value: string): Promise<void> {
  const store = await cookies();
  store.set(EXCHANGE_VIEW_COOKIE, parseExchangeView(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
