/** @type {import('next').NextConfig} */
const nextConfig = {
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
