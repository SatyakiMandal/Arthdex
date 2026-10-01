import type { MetadataRoute } from "next";
import { getUnlistedDirectory } from "@/lib/api/endpoints";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

const STATIC = [
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
];

/** Static pages, plus every unlisted company page the directory currently carries. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/market-watch" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  const directory = await getUnlistedDirectory();
  if (directory.ok) {
    for (const c of directory.data.companies) {
      pages.push({ url: `${SITE}/unlisted/${c.id}`, lastModified: now, changeFrequency: "daily", priority: 0.5 });
    }
  }
  return pages;
}
