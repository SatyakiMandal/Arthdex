import type { MetadataRoute } from "next";
import { getUnlistedDirectory } from "@/lib/api/endpoints";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

const STATIC_DESKS = [
  "",
  "/market-watch",
  "/commodities",
  "/screener",
  "/bhavcopy",
  "/ipo",
  "/news",
  "/unlisted",
  "/deals",
  "/calendar",
  "/briefing",
  "/methodology",
  "/status",
  "/alerts",
  "/portfolio",
  "/watchlist",
  "/compare",
  "/derivatives",
  "/orderflow",
  "/results",
  "/track-record",
  "/live",
  "/surveillance",
  "/macro",
  "/participant-oi",
  "/volatility",
  "/strategy-builder",
  "/yield-curve",
  "/funds",
  "/fx",
  "/paper-trading",
  "/help",
  "/network",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/copyright",
];

/**
 * Builds the comprehensive sitemap for all platform desks, legal compliance pages,
 * and dynamic unlisted company dossiers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC_DESKS.map((path) => {
    let changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" = "daily";
    let priority = 0.7;

    if (path === "") {
      changeFrequency = "hourly";
      priority = 1.0;
    } else if (path === "/market-watch" || path === "/derivatives" || path === "/orderflow" || path === "/live") {
      changeFrequency = "hourly";
      priority = 0.9;
    } else if (path.startsWith("/privacy") || path.startsWith("/terms") || path.startsWith("/disclaimer") || path.startsWith("/copyright")) {
      changeFrequency = "monthly";
      priority = 0.4;
    }

    return {
      url: `${SITE}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    };
  });

  try {
    const directory = await getUnlistedDirectory();
    if (directory.ok && directory.data?.companies) {
      for (const c of directory.data.companies) {
        pages.push({
          url: `${SITE}/unlisted/${c.id}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Graceful fallback if unlisted directory service is initializing
  }

  return pages;
}
