// Wave 37 — 5.10 Storybook for the shared component library.
//
// Spec: docs/projects/platform-overhaul/decisions/5.10-component-library-docs.md
//
// Framework: Storybook 10 + react-vite (Vite 7 compatible). Storybook 10
// folded the previous addon-essentials / addon-interactions packages into
// the core, so the addon list intentionally only carries `addon-a11y` —
// the docs/controls/actions/viewport/backgrounds/measure/outline/test
// behaviour now ships with the framework itself.

import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

// `__dirname` is not defined in ESM modules; reconstruct it from
// `import.meta.url` so the alias resolution below stays portable
// across Node ESM and the bundled Storybook builder.
const here = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../client/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Storybook 10 enables docgen-react out of the box; `typescript.check`
  // is intentionally false because we already run `tsc` as a separate
  // gate (`npm run check`) and the Storybook build does not need its
  // own type-checker pass.
  typescript: {
    check: false,
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal: async (viteConfig) => {
    // Mirror the path aliases from the main Vite config so stories can
    // import `@/components/...` and `@shared/...` exactly like app code.
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": path.resolve(here, "..", "client", "src"),
          "@shared": path.resolve(here, "..", "shared"),
          "@assets": path.resolve(here, "..", "attached_assets"),
        },
      },
    });
  },
  docs: {
    autodocs: false,
  },
};

export default config;
