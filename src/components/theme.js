import { useColorScheme } from "react-native";

// Tokens from the prototype's Styles.html, adjusted to meet WCAG AA without
// backdrop blur (see theme.contrast.test.js). Glass is more opaque than the
// prototype's because nothing blurs the background behind it yet.
const light = {
  dark: false,
  bg: ["#e3ecff", "#f5e6ff", "#dcfbef"],
  blobs: ["#7aa2ff", "#ff8fd6", "#5fe1bb"],
  text: "#1b1d24",
  muted: "#474c5c",
  placeholder: "#5a5f70",
  glass: "rgba(255, 255, 255, 0.72)",
  field: "rgba(255, 255, 255, 0.85)",
  fieldFocus: "rgba(255, 255, 255, 0.95)",
  fieldBorder: "rgba(60, 66, 90, 0.62)",
  border: "rgba(255, 255, 255, 0.65)",
  edge: "rgba(255, 255, 255, 0.95)",
  sheen: "rgba(255, 255, 255, 0.55)",
  codeBg: "rgba(255, 255, 255, 0.6)",
  shadow: "0px 12px 40px rgba(40, 50, 120, 0.18)",
  accent: "#3b6cff",
  link: "#2a52cc",
  buttonFrom: "#2f5be6",
  buttonTo: "#6e42d6",
  ring: "rgba(59, 108, 255, 0.22)",
  danger: "#b42318",
  scrim: "rgba(20, 24, 45, 0.35)",
  sheet: "rgba(255, 255, 255, 0.96)",
};

const dark = {
  dark: true,
  bg: ["#0d1022", "#1a1030", "#0b1f1c"],
  blobs: ["#3651c9", "#a13a8c", "#1f8f74"],
  text: "#eef0f7",
  muted: "#c3c8d9",
  placeholder: "#aab0c3",
  glass: "rgba(22, 24, 38, 0.72)",
  field: "rgba(255, 255, 255, 0.08)",
  fieldFocus: "rgba(255, 255, 255, 0.13)",
  fieldBorder: "rgba(255, 255, 255, 0.42)",
  border: "rgba(255, 255, 255, 0.14)",
  edge: "rgba(255, 255, 255, 0.22)",
  sheen: "rgba(255, 255, 255, 0.1)",
  codeBg: "rgba(255, 255, 255, 0.1)",
  shadow: "0px 16px 50px rgba(0, 0, 0, 0.5)",
  accent: "#5b82ff",
  link: "#93acff",
  buttonFrom: "#2f5be6",
  buttonTo: "#6e42d6",
  ring: "rgba(91, 130, 255, 0.3)",
  danger: "#ff8f85",
  scrim: "rgba(0, 0, 0, 0.55)",
  sheet: "rgba(28, 30, 44, 0.98)",
};

export const themes = { light, dark };

export const radius = { card: 22, field: 13, button: 14 };

export function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}
