import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: ".1875rem", /* 3px */
        md: ".375rem", /* 6px */
        lg: ".5625rem", /* 9px */
        xl: "0.75rem", /* 12px */
        "2xl": "1rem", /* 16px */
        full: "9999px",
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        // Material Design 3 Colors (non-conflicting semantic names)
        "error": "#ba1a1a",
        "tertiary": "#7b2600",
        "primary-fixed": "#dae2ff",
        "on-error": "#ffffff",
        "on-tertiary": "#ffffff",
        "on-secondary": "#ffffff",
        "on-secondary-fixed-variant": "#344573",
        "on-tertiary-container": "#ffc6b2",
        "on-background": "#191c1d",
        "on-surface": "#191c1d",
        "on-primary": "#ffffff",
        "inverse-primary": "#b2c5ff",
        "surface-container-high": "#e7e8e9",
        "surface-container-highest": "#e1e3e4",
        "primary-container": "#0052cc",
        "primary-fixed-dim": "#b2c5ff",
        "inverse-surface": "#2e3132",
        "on-tertiary-fixed-variant": "#812800",
        "tertiary-fixed": "#ffdbcf",
        "secondary-container": "#b6c8fe",
        "surface-bright": "#f8f9fa",
        "error-container": "#ffdad6",
        "surface": "#f8f9fa",
        "surface-container-lowest": "#ffffff",
        "on-surface-variant": "#434654",
        "on-primary-container": "#c4d2ff",
        "on-tertiary-fixed": "#380d00",
        "surface-dim": "#d9dadb",
        "tertiary-fixed-dim": "#ffb59b",
        "inverse-on-surface": "#f0f1f2",
        "surface-container-low": "#f3f4f5",
        "secondary-fixed-dim": "#b4c5fb",
        "on-secondary-fixed": "#021945",
        "surface-container": "#edeeef",
        "on-secondary-container": "#415382",
        "on-primary-fixed-variant": "#0040a2",
        "secondary-fixed": "#dae2ff",
        "on-primary-fixed": "#001848",
        "surface-variant": "#e1e3e4",
        "background": "#f8f9fa",
        "on-error-container": "#93000a",
        "surface-tint": "#0c56d0",
        "tertiary-container": "#a33500",
        "outline": "#737685",
        "outline-variant": "#c3c6d6",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        headline: ["var(--font-headline)"],
        body: ["var(--font-body)"],
        label: ["var(--font-label)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
