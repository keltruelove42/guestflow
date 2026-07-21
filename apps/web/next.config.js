/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@guestflow/shared",
    "@guestflow/db",
    "@guestflow/core",
    "@guestflow/api-client",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    // Prisma's client engine reads query_compiler_bg.wasm from disk at runtime;
    // Vercel's file tracing misses it, so include it explicitly for all routes.
    outputFileTracingIncludes: {
      "/**/*": [
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.wasm",
        "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*.js",
      ],
    },
  },
};

module.exports = nextConfig;
