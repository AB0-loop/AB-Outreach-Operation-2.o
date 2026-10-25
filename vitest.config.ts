import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src"), "server-only": resolve(__dirname, "src/test/server-only.ts") } },
  test: { environment: "node", include: ["src/**/*.test.ts"], sequence: { concurrent: false }, fileParallelism: false },
});
