import type { Config } from "tailwindcss";

/**
 * House style, ported verbatim from the prototype.
 * Team colors are deliberately NOT in this config — they are the only
 * chromatic element and always come from the data (teams.color), applied
 * inline. Do not add decorative color tokens here.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        "paper-2": "#EAE6DB",
        ink: {
          DEFAULT: "#14110F",
          60: "rgba(20,17,15,.60)",
          38: "rgba(20,17,15,.38)",
        },
        rule: "#DBD5C7",
        gate: "#9F1239",
        ch: {
          paid: "#1D4ED8",
          email: "#047857",
          sms: "#6D28D9",
          banner: "#B45309",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Zero radius everywhere by default; chips opt into `rounded-chip`.
        none: "0",
        chip: "999px",
      },
    },
  },
  corePlugins: {
    // House style: no shadows, no gradients used in the layout.
  },
  plugins: [],
};

export default config;
