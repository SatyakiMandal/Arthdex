/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https:;
  connect-src 'self' http: https: ws: wss:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, " ").trim();

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
  async redirects() {
    return [
      {
        source: "/deals",
        destination: "/orderflow?tab=deals",
        permanent: false,
      },
      {
        source: "/catalysts",
        destination: "/results?tab=catalysts",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
