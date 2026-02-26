import {
  createTheme,
  type MantineColorsTuple,
  type CSSVariablesResolver,
} from "@mantine/core";

/* ── Custom color palettes (10 shades each) ── */

const accent: MantineColorsTuple = [
  "#eef0fb",
  "#d4d8f2",
  "#b8bfe8",
  "#9ca6de",
  "#8492e5",
  "#6c7ee1",
  "#5b6bcf",
  "#4a58b8",
  "#3c48a0",
  "#2e3888",
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

export const agenticTheme = createTheme({
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
  },
  primaryColor: "accent",
  fontFamily: "Geist, sans-serif",
  fontFamilyMonospace: "Geist Mono, JetBrains Mono, Cascadia Code, monospace",
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
    "--text-tertiary": "#50505f",

    /* Accent */
    "--accent": "#6c7ee1",
    "--accent-hover": "#7d8ee8",
    "--accent-glow": "#8b9cf7",

    /* Agent tones */
    "--claude": "#d4a574",
    "--gemini": "#6bcf8e",

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
  },
});
