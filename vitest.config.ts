import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";
import { resolve } from "path";

export default defineConfig({
  plugins: [WxtVitest()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    restoreMocks: true,
    include: ["src/**/*.test.ts", "benches/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/ui/**", "src/entrypoints/**"],
    },
  },
});
