import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@guestflow/db": path.resolve(__dirname, "../db/src"),
      "@guestflow/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
