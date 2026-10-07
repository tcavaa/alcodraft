import path from "node:path";

import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
