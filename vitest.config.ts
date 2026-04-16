import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  test: {
    globals: true,
    include: [
      "tests/**/*.test.{ts,tsx}",
      "client/src/**/*.test.{ts,tsx}",
      "server/**/*.test.ts",
      "shared/**/*.test.ts",
    ],
    environmentMatchGlobs: [
      ["tests/**/*.client.test.tsx", "jsdom"],
      ["client/src/**/*.test.tsx", "jsdom"],
    ],
    environment: "node",
    setupFiles: ["./tests/setup/client-setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
