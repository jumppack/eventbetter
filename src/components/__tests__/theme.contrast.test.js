// WCAG AA for every text/background pair in both themes. Translucent layers
// are composited over the lightest and darkest spots of the background
// (each gradient stop, with and without a blob on top) and the worst case
// must pass: 4.5:1 for text, 3:1 for field borders.
import { themes } from "../theme";

const parse = (c) => {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const [r, g, b, a = 1] = c.match(/\(([^)]+)\)/)[1].split(",").map(Number);
  return [r, g, b, a];
};

const over = (top, base) => {
  const [r, g, b, a] = parse(top);
  return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Blobs are drawn at 55% opacity (Glass.js).
const withAlpha = (hex, a) => `rgba(${parse(hex).slice(0, 3).join(",")},${a})`;

describe.each(Object.entries(themes))("%s theme", (_name, t) => {
  const spots = t.bg.flatMap((bg) => {
    const base = parse(bg);
    return [base, ...t.blobs.map((blob) => over(withAlpha(blob, 0.55), base))];
  });
  const cards = spots.map((s) => over(t.glass, s));
  const fields = cards.map((c) => over(t.field, c));
  const worst = (fg, bases) => Math.min(...bases.map((b) => ratio(over(fg, b), b)));

  it.each([
    ["text on card", "text", "cards", 4.5],
    ["help text on card", "muted", "cards", 4.5],
    ["field text", "text", "fields", 4.5],
    ["placeholder", "placeholder", "fields", 4.5],
    ["link", "link", "cards", 4.5],
    ["error text", "danger", "cards", 4.5],
    ["field border", "fieldBorder", "cards", 3],
    ["footer text on background", "text", "spots", 4.5],
    ["footer help text on background", "muted", "spots", 4.5],
  ])("%s meets AA", (_label, token, surface, need) => {
    const bases = { cards, fields, spots }[surface];
    expect(worst(t[token], bases)).toBeGreaterThanOrEqual(need);
  });

  it("white button label meets AA at both gradient ends", () => {
    for (const end of [t.buttonFrom, t.buttonTo]) {
      expect(ratio([255, 255, 255], parse(end).slice(0, 3))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
