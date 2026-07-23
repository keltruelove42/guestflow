/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework, and never ship readable source maps to the
  // browser (raises the bar for anyone trying to lift the client code).
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  transpilePackages: [
    "@guestflow/shared",
    "@guestflow/db",
    "@guestflow/core",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    // Vercel/pnpm monorepo: file tracing misses the generated Prisma client's
    // native engine binary; include the whole generated client dir explicitly.
    outputFileTracingIncludes: {
      "/**/*": [
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
      ],
      "/api/**/*": [
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
      ],
    },
  },
};

module.exports = nextConfig;
