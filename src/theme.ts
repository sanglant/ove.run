import {
  createTheme,
  type MantineColorsTuple,
  type CSSVariablesResolver,
} from "@mantine/core";

/* ── Custom color palettes (10 shades each) ── */

const accent: MantineColorsTuple = [
  "#fdf6ee",
  "#f5e4cc",
  "#ecd2aa",
  "#e3bf88",
  "#dcb06e",
  "#d4943c",
  "#c08535",
  "#a8742e",
  "#906327",
  "#785220",
];

const danger: MantineColorsTuple = [
  "#fdf0f1",
  "#f5d5d8",
  "#edb9bf",
  "#e59da6",
  "#e5868f",
  "#e5737f",
  "#d4626e",
  "#bf515d",
  "#a8414d",
  "#91323e",
];

const success: MantineColorsTuple = [
  "#f0f7ef",
  "#d6e8d3",
  "#bcdab7",
  "#a2cb9b",
  "#8cc084",
  "#7ab573",
  "#69a462",
  "#589352",
  "#488243",
  "#387134",
];

const warning: MantineColorsTuple = [
  "#faf5ef",
  "#efe2d0",
  "#e4cfb1",
  "#d9bc92",
  "#d4a56a",
  "#c99858",
  "#b98947",
  "#a67a38",
  "#936b2a",
  "#805c1c",
];

const claude: MantineColorsTuple = [
  "#faf6f1",
  "#f0e4d6",
  "#e5d2bb",
  "#dbc0a0",
  "#d4a574",
  "#c99963",
  "#b98a53",
  "#a67b44",
  "#936c36",
  "#805d28",
];

const gemini: MantineColorsTuple = [
  "#edf9f1",
  "#d0efd9",
  "#b3e5c1",
  "#96dba9",
  "#6bcf8e",
  "#5cc47f",
  "#4db370",
  "#3ea261",
  "#2f9152",
  "#208043",
];

const copilot: MantineColorsTuple = [
  "#eef4ff",
  "#d4e2f9",
  "#b8d0f3",
  "#9cbeed",
  "#79a9e8",
  "#5f96e0",
  "#4a83d4",
  "#3970c0",
  "#2d5da8",
  "#214a90",
];

const codex: MantineColorsTuple = [
  "#f3eefb",
  "#e0d4f2",
  "#cdb9e9",
  "#ba9ee0",
  "#a883d7",
  "#966dce",
  "#8458c0",
  "#7244ad",
  "#60369a",
  "#4e2987",
];

const arbiter: MantineColorsTuple = [
  "#e6faf7",  // 0 - lightest
  "#ccf5ef",  // 1
  "#99ebe0",  // 2
  "#66e0d0",  // 3
  "#4ecdc4",  // 4 - primary
  "#3dbdb5",  // 5
  "#2eada6",  // 6
  "#1f9d97",  // 7
  "#108d88",  // 8
  "#007d79",  // 9 - darkest
];

export const oveRunTheme = createTheme({
  colors: {
    dark: [
      "#e8e8f0", // dark[0] — text-primary
      "#c0c0d0", // dark[1]
      "#8888a0", // dark[2] — text-secondary
      "#50505f", // dark[3] — text-tertiary
      "#2e2e3e", // dark[4] — border-bright
      "#1e1e26", // dark[5] — border
      "#222228", // dark[6] — bg-elevated
      "#1a1a1f", // dark[7] — bg-tertiary
      "#111114", // dark[8] — bg-secondary
      "#090909", // dark[9] — bg-primary
    ],
    accent,
    danger,
    success,
    warning,
    claude,
    gemini,
    copilot,
    codex,
    arbiter,
  },
  primaryColor: "accent",
  fontFamily: "Geist, sans-serif",
  fontFamilyMonospace: "Geist Mono, JetBrains Mono, Cascadia Code, monospace",
  headings: { fontFamily: "Outfit, Geist, sans-serif" },
  defaultRadius: "sm",
});

export const cssResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    /* Backgrounds */
    "--bg-primary": "#090909",
    "--bg-secondary": "#111114",
    "--bg-tertiary": "#1a1a1f",
    "--bg-elevated": "#222228",

    /* Text */
    "--text-primary": "#e8e8f0",
    "--text-secondary": "#8888a0",
    "--text-tertiary": "#7a7a8a",

    /* Accent */
    "--accent": "#d4943c",
    "--accent-hover": "#e0a54e",
    "--accent-glow": "#eab76a",

    /* Agent tones */
    "--claude": "#d4a574",
    "--gemini": "#6bcf8e",
    "--copilot": "#79a9e8",
    "--codex": "#a883d7",
    "--arbiter": "#4ecdc4",
    "--arbiter-glow": "#6ee7de",

    /* Semantic */
    "--danger": "#e5737f",
    "--success": "#8cc084",
    "--warning": "#d4a56a",

    /* Borders */
    "--border": "#1e1e26",
    "--border-bright": "#2e2e3e",

    /* Glow effects */
    "--glow-accent":
      "0 0 0 1px var(--accent), 0 0 12px 0 color-mix(in srgb, var(--accent) 35%, transparent)",
    "--glow-danger":
      "0 0 0 1px var(--danger), 0 0 12px 0 color-mix(in srgb, var(--danger) 35%, transparent)",
    "--glow-claude":
      "0 0 0 1px var(--claude), 0 0 12px 0 color-mix(in srgb, var(--claude) 35%, transparent)",
    "--glow-gemini":
      "0 0 0 1px var(--gemini), 0 0 12px 0 color-mix(in srgb, var(--gemini) 35%, transparent)",
    "--glow-copilot":
      "0 0 0 1px var(--copilot), 0 0 12px 0 color-mix(in srgb, var(--copilot) 35%, transparent)",
    "--glow-codex":
      "0 0 0 1px var(--codex), 0 0 12px 0 color-mix(in srgb, var(--codex) 35%, transparent)",
    "--glow-arbiter":
      "0 0 0 1px var(--arbiter), 0 0 12px 0 color-mix(in srgb, var(--arbiter) 35%, transparent)",
  },
});
