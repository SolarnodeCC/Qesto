// AUTO-GENERATED from docs/spec/design-tokens.json — do not edit by hand.
// This file is used by vite.config.ts to extend the Tailwind theme.
// Regenerate: `npm run tokens:build`. See DESIGN-TOK-01.

export const theme = {
  "colors": {
    "teal": {
      "50": "#F0FDFA",
      "100": "#CCFBF1",
      "200": "#99F6E4",
      "300": "#5EE7DF",
      "400": "#2DD4BF",
      "500": "#14B8A6",
      "600": "#0D9488",
      "700": "#0F766E",
      "800": "#115E59",
      "900": "#134E4A"
    },
    "violet": {
      "50": "#F5F3FF",
      "100": "#EDE9FE",
      "200": "#DDD6FE",
      "300": "#C4B5FD",
      "400": "#A78BFA",
      "500": "#8B5CF6",
      "600": "#7C3AED",
      "700": "#6D28D9",
      "800": "#5B21B6",
      "900": "#4C1D95"
    },
    "pulse": {
      "50": "#FAFAFA",
      "100": "#F5F5F5",
      "200": "#E5E5E5",
      "300": "#D4D4D4",
      "400": "#A3A3A3",
      "500": "#737373",
      "600": "#525252",
      "700": "#404040",
      "800": "#262626",
      "900": "#0A0F1E"
    },
    "success": "#22C55E",
    "warning": "#F59E0B",
    "error": "#DC2626",
    "info": "#0EA5E9",
    "background": "#FFFFFF",
    "background-subtle": "#FAFAFA",
    "border": "#E5E7EB",
    "border-strong": "#D1D5DB",
    "text-primary": "#0A0F1E",
    "text-secondary": "#525252",
    "text-muted": "#A3A3A3",
    "text-on-brand": "#FFFFFF",
    "text-link": "#0D9488",
    "text-link-ai": "#7C3AED"
  },
  "spacing": {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
    "24": "6rem",
    "32": "8rem",
    "48": "12rem",
    "64": "16rem",
    "96": "24rem"
  },
  "borderRadius": {
    "sm": "6px",
    "md": "10px",
    "lg": "16px",
    "xl": "24px",
    "pill": "9999px"
  },
  "boxShadow": {
    "card": "0 2px 8px rgba(10, 15, 30, 0.06)",
    "elevated": "0 8px 24px rgba(10, 15, 30, 0.10)",
    "teal": "0 4px 20px rgba(20, 184, 166, 0.25)",
    "ai": "0 4px 20px rgba(139, 92, 246, 0.25)",
    "focus-ring": "0 0 0 3px rgba(20, 184, 166, 0.4)"
  },
  "fontFamily": {
    "sans": "'Inter', sans-serif",
    "display": "'Syne', sans-serif",
    "mono": "'JetBrains Mono', monospace"
  },
  "fontSize": {},
  "fontWeight": {
    "normal": "400",
    "medium": "500",
    "semibold": "600",
    "bold": "700"
  },
  "extend": {
    "transitionTimingFunction": {
      "standard": "cubic-bezier(0.2, 0, 0, 1)",
      "enter": "cubic-bezier(0.0, 0, 0.2, 1)",
      "exit": "cubic-bezier(0.4, 0, 1, 1)"
    },
    "borderWidth": {},
    "gridTemplateColumns": {
      "1": "repeat(1, minmax(0, 1fr))",
      "2": "repeat(2, minmax(0, 1fr))",
      "3": "repeat(3, minmax(0, 1fr))",
      "4": "repeat(4, minmax(0, 1fr))",
      "5": "repeat(5, minmax(0, 1fr))",
      "6": "repeat(6, minmax(0, 1fr))",
      "7": "repeat(7, minmax(0, 1fr))",
      "8": "repeat(8, minmax(0, 1fr))",
      "9": "repeat(9, minmax(0, 1fr))",
      "10": "repeat(10, minmax(0, 1fr))",
      "11": "repeat(11, minmax(0, 1fr))",
      "12": "repeat(12, minmax(0, 1fr))"
    },
    "gap": {}
  }
} as const
