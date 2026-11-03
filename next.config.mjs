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
};

export default nextConfig;
