import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arthdex · Quantitative Financial Intelligence",
    short_name: "Arthdex",
    description:
      "Indian market quantitative financial advisory and intelligence platform covering NSE listed stocks, derivatives, unlisted valuations, and IPO analytics.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0f0e",
    theme_color: "#0c0f0e",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
