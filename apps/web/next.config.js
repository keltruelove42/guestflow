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
  },
};

module.exports = nextConfig;
