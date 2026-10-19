import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      include: ["src/domain/**/*.ts"],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
