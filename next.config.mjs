/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dynamic pages otherwise stream <title> and the meta description into <body> for
  // non-bot user agents. Every crawler, link unfurler and audit tool should find them
  // in <head>, so metadata is always rendered blocking.
  htmlLimitedBots: /.*/,
  experimental: {
    // Tree-shake icon and animation barrels so a page ships only what it imports
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
