import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname) } },
  test: { environment: "node", env: { LL_DB_FILE: ":memory:" }, include: ["tests/**/*.test.ts"] },
});
