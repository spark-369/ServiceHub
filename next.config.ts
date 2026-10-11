import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Fail the production build on type errors rather than shipping broken code.
  // (Next.js 16 removed the `eslint` config key along with `next lint`; run
  // ESLint via the CLI in CI instead.)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Do not advertise the framework version.
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  // Only enable source maps for errors (smaller, safer client bundles).
  productionBrowserSourceMaps: false,

  // Packages that use Node.js-specific features must be externalized.
  // (`@huggingface/transformers` and `@prisma/client` are auto-externalized
  // by Next.js, but listing them explicitly is harmless and self-documenting.)
  serverExternalPackages: ["@prisma/client", "ioredis"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.stripe.com" },
    ],
  },

  // Baseline security headers for all routes. The global proxy (`src/proxy.ts`)
  // additionally applies headers, CORS and rate limiting to API responses.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Never cache API responses by default.
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;

