// Wave 37 — 5.10 Storybook preview configuration.
//
// Importing the global Tailwind stylesheet here so every story renders
// with the exact same CSS variables, tokens, and utility classes as the
// real app. Without this import the cards, buttons, and badges fall
// back to unstyled HTML.

import type { Preview } from "@storybook/react-vite";

import "../client/src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Use Storybook 10's "todo" mode so a11y findings surface in the
      // panel without failing builds — the goal of this wave is to make
      // findings visible, not to block on the existing component
      // inventory until 5.5 lands a separate remediation pass.
      test: "todo",
    },
    layout: "padded",
  },
};

export default preview;
