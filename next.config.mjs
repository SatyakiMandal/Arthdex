const isDev = process.env.NODE_ENV !== "production";

// Every browser request goes to this origin (the data service and the model API are called
// server-side), so connect-src is 'self'. React's dev overlay needs eval and a websocket;
// production gets neither. 'unsafe-inline' stays for Next's inline bootstrap scripts until
// the pages move to nonces, which would force every page to render dynamically.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https:;
  connect-src 'self'${isDev ? " ws: wss:" : ""};
  media-src 'self' blob:;
  worker-src 'self' blob:;
  frame-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`.replace(/\s{2,}/g, " ").trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
