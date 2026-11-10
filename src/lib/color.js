// Event colors: the picker's palette, tone rows and readable text colors.
// Pure functions with no dependencies.

// Google's own colors (the 24 default labels). Each hue chip is the one of
// these that best stands for the hue, and the tone row is built around it.
export const HUES = [
  { name: "Red", hex: "#d50000" },
  { name: "Orange", hex: "#ef6c00" },
  { name: "Yellow", hex: "#f6bf26" },
  { name: "Green", hex: "#33b679" },
  { name: "Teal", hex: "#009688" },
  { name: "Blue", hex: "#4285f4" },
  { name: "Purple", hex: "#8e24aa" },
  { name: "Pink", hex: "#d81b60" },
  { name: "Brown", hex: "#795548" },
  { name: "Gray", hex: "#616161" },
];

// Calendar's classic 11 colors by `colorId`, written as the matching default
// labels. Used on accounts without event labels, where only colorId works.
export const CLASSIC_COLORS = [
  { id: "1", name: "Lavender", hex: "#7986cb" },
  { id: "2", name: "Sage", hex: "#33b679" },
  { id: "3", name: "Grape", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", hex: "#e67c73" },
  { id: "5", name: "Banana", hex: "#f6bf26" },
  { id: "6", name: "Tangerine", hex: "#f4511e" },
  { id: "7", name: "Peacock", hex: "#039be5" },
  { id: "8", name: "Graphite", hex: "#616161" },
  { id: "9", name: "Blueberry", hex: "#3f51b5" },
  { id: "10", name: "Basil", hex: "#0b8043" },
  { id: "11", name: "Tomato", hex: "#d50000" },
];

export const TONE_COUNT = 7;
export const TONE_STEP = 10;
export const TONE_MIN = 25;
export const TONE_MAX = 95;

// Lowercase "#rrggbb", or null if the value isn't a hex color.
export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^#([0-9a-fA-F]{6})$/);
  return match ? "#" + match[1].toLowerCase() : null;
}

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

const toHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// WCAG 2.x relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pure black or white, whichever reads better. One of them always reaches at
// least 4.58:1, so this meets WCAG's 4.5:1 on every possible color; a dark
// gray text color cannot promise that on mid-tones.
export function textOn(hex) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#000000") ? "#ffffff" : "#000000";
}

function mix(from, to, amount) {
  const a = toRgb(from);
  const b = toRgb(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}

// How far the tile color is mixed toward black or white for a progress track.
export const TRACK_MIX = 0.4;

// Colors for a list tile painted in `hex`. The track is the tile color pushed
// toward white or black, whichever shows more, as long as the solid fill still
// contrasts 3:1 with it (WCAG 1.4.11). Pushing away from the text color always
// qualifies, because it can only increase the fill's contrast.
export function tileColors(hex) {
  const text = textOn(hex);
  const awayFromText = mix(hex, text === "#ffffff" ? "#000000" : "#ffffff", TRACK_MIX);
  const towardText = mix(hex, text, TRACK_MIX);
  const useToward = contrast(text, towardText) >= 3 && contrast(hex, towardText) > contrast(hex, awayFromText);
  return { background: hex, text, fill: text, track: useToward ? towardText : awayFromText };
}

// CIELAB (D65), whose L* is the lightness scale of Material 3 tones.
const WHITE = [0.95047, 1, 1.08883];
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

export function toLab(hex) {
  const [r, g, b] = toRgb(hex).map(linear);
  const xyz = [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
  const [fx, fy, fz] = xyz.map((v, i) => {
    const t = v / WHITE[i];
    return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  });
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToLinear([L, a, b]) {
  const fy = (L + 16) / 116;
  const [x, y, z] = [fy + a / 500, fy, fy - b / 200].map((f, i) => {
    const cubed = f ** 3;
    return WHITE[i] * (cubed > EPSILON ? cubed : (116 * f - 16) / KAPPA);
  });
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

// A color at lightness L*, chroma C and hue angle h (radians). Where that
// leaves sRGB, the chroma is lowered until it fits, so lightness stays exact.
export function fromLch(L, C, h) {
  const at = (c) => labToLinear([L, c * Math.cos(h), c * Math.sin(h)]);
  let lo = 0;
  let hi = C;
  if (inGamut(at(hi))) lo = hi;
  else {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
  }
  return toHex(at(lo).map((v) => 255 * gamma(Math.min(1, Math.max(0, v)))));
}

// Seven tones, lightest first, spaced exactly 10 apart in L* around a hue's
// default color. The window of L* 25 to 95 is placed so that one step lands
// on the default itself, as close to the middle as the window allows; every
// other tone keeps the default's hue and chroma (chroma lowered where a tone
// would leave sRGB).
export function toneRow(center) {
  const [L, a, b] = toLab(center);
  const chroma = Math.hypot(a, b);
  const hue = Math.atan2(b, a);
  const span = TONE_STEP * (TONE_COUNT - 1);

  // k tones sit below the default. The window must stay inside [MIN, MAX].
  const lowest = Math.max(0, Math.ceil((L + span - TONE_MAX) / TONE_STEP));
  const highest = Math.min(TONE_COUNT - 1, Math.floor((L - TONE_MIN) / TONE_STEP));
  const below = Math.min(Math.max(Math.floor(TONE_COUNT / 2), lowest), Math.max(lowest, highest));

  const start = L - TONE_STEP * below;
  return Array.from({ length: TONE_COUNT }, (_, i) =>
    i === below ? center : fromLch(start + TONE_STEP * i, chroma, hue),
  ).reverse();
}

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

export function classicIdFor(hex) {
  return CLASSIC_COLORS.find((c) => c.hex === hex)?.id ?? null;
}

// The classic color closest to any hex, for accounts without event labels.
export function nearestClassic(hex) {
  const lab = toLab(hex);
  return CLASSIC_COLORS.reduce((best, c) =>
    distance(toLab(c.hex), lab) < distance(toLab(best.hex), lab) ? c : best,
  );
}

// Which hue chip a color belongs to: the chip whose tone row contains it, or
// else the nearest by hue and chroma (lightness ignored). Index into HUES.
export function hueIndexOf(hex) {
  const exact = HUES.findIndex((h) => toneRow(h.hex).includes(hex));
  if (exact >= 0) return exact;
  const [, a, b] = toLab(hex);
  let best = 0;
  HUES.forEach((h, i) => {
    const [, ha, hb] = toLab(h.hex);
    const [, ba, bb] = toLab(HUES[best].hex);
    if (distance([ha, hb], [a, b]) < distance([ba, bb], [a, b])) best = i;
  });
  return best;
}
