import { MarketTicker } from "./market-ticker";
import { HeaderBar } from "./header-bar";

/**
 * App shell header.
 *
 * A server component so the live index ticker can fetch on the server; the
 * interactive bar below it is a separate client component. A client component
 * cannot import an async server component, which is why these are split.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full">
      <MarketTicker />
      <HeaderBar />
    </header>
  );
}
