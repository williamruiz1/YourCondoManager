import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Tailwind CSS v3's generateRules.js calls postcss.parse() without a `from`
// option when validating arbitrary CSS values (isParsableCssValue helper).
// This causes Vite 7's UrlRewritePostcssPlugin to emit a one-time warning
// because synthetic nodes injected by Tailwind lack source.input.file.
// The warning is a false positive — no real asset URLs are involved.
// Fixed upstream only in Tailwind v4+; suppress here until we migrate.
// See: https://github.com/tailwindlabs/tailwindcss/issues/14316
const logger = createLogger();
const originalWarnOnce = logger.warnOnce.bind(logger);
logger.warnOnce = (msg, options) => {
  if (msg.includes("did not pass the `from` option to `postcss.parse`")) return;
  originalWarnOnce(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
