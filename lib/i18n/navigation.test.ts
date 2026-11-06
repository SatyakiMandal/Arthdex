import { describe, it, expect } from "vitest";
import { getLocalizedNavGroups } from "./navigation";
import { DICTIONARIES } from "./locales";

describe("Localized Navigation System", () => {
  it("generates 3 primary navigation groups for English", () => {
    const groups = getLocalizedNavGroups("en", DICTIONARIES.en);
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe("Markets");
    expect(groups[1].label).toBe("Companies");
    expect(groups[2].label).toBe("Research");
  });

  it("dynamically returns Hindi titles and blurbs when locale is 'hi'", () => {
    const groups = getLocalizedNavGroups("hi", DICTIONARIES.hi);
    expect(groups).toHaveLength(3);
    expect(groups[0].label).toBe("बाज़ार (Markets)");
    expect(groups[1].label).toBe("कंपनियाँ (Companies)");
    expect(groups[2].label).toBe("अनुसंधान (Research)");
    expect(groups[0].blurb).toContain("बाज़ार");

    const marketWatch = groups[0].items.find((i) => i.href === "/market-watch");
    expect(marketWatch?.label).toBe(DICTIONARIES.hi.nav.marketWatch);
  });

  it("dynamically returns Bengali titles when locale is 'bn'", () => {
    const groups = getLocalizedNavGroups("bn", DICTIONARIES.bn);
    expect(groups[0].label).toBe("বাজার (Markets)");
    expect(groups[1].label).toBe("কোম্পানি (Companies)");
    expect(groups[2].label).toBe("গবেষণা (Research)");
  });

  it("dynamically returns Tamil titles when locale is 'ta'", () => {
    const groups = getLocalizedNavGroups("ta", DICTIONARIES.ta);
    expect(groups[0].label).toBe("சந்தை (Markets)");
    expect(groups[1].label).toBe("நிறுவனங்கள் (Companies)");
    expect(groups[2].label).toBe("ஆராய்ச்சி (Research)");
  });
});
