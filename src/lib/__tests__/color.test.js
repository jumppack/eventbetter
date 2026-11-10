import {
  CLASSIC_COLORS,
  HUES,
  TONE_COUNT,
  TONE_MAX,
  TONE_MIN,
  classicIdFor,
  contrast,
  fromLch,
  hueIndexOf,
  luminance,
  nearestClassic,
  normalizeHex,
  textOn,
  tileColors,
  toLab,
  toneRow,
} from "../color";

const allPaletteColors = () => [
  ...HUES.flatMap((h) => toneRow(h.hex)),
  ...CLASSIC_COLORS.map((c) => c.hex),
];

describe("normalizeHex", () => {
  it.each([
    ["#8E24AA", "#8e24aa"],
    ["  #8e24aa ", "#8e24aa"],
  ])("accepts %p", (input, expected) => {
    expect(normalizeHex(input)).toBe(expected);
  });

  it.each(["8e24aa", "#8e24a", "#8e24aaff", "blue", "", null, undefined, 12])("rejects %p", (input) => {
    expect(normalizeHex(input)).toBeNull();
  });
});

describe("contrast", () => {
  it("matches WCAG's reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("textOn", () => {
  it("picks white on dark and black on light colors", () => {
    expect(textOn("#8e24aa")).toBe("#ffffff");
    expect(textOn("#f6bf26")).toBe("#000000");
  });

  it("reaches WCAG AA (4.5:1) on every palette color", () => {
    for (const hex of allPaletteColors()) {
      expect(contrast(hex, textOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("reaches WCAG AA on a grid across the whole RGB cube", () => {
    let worst = Infinity;
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 15) {
        for (let b = 0; b <= 255; b += 15) {
          const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
          worst = Math.min(worst, contrast(hex, textOn(hex)));
        }
      }
    }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });
});

describe("tileColors", () => {
  it("keeps the progress fill at least 3:1 against its track on every palette color", () => {
    for (const hex of allPaletteColors()) {
      const { fill, track } = tileColors(hex);
      expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the track visibly different from the tile", () => {
    for (const hex of allPaletteColors()) {
      const { background, track } = tileColors(hex);
      expect(contrast(background, track)).toBeGreaterThanOrEqual(1.2);
    }
  });
});

describe("toneRow", () => {
  it.each(HUES.map((h) => [h.name, h.hex]))("%s: seven tones, lightest first, evenly spaced in L*", (_name, hex) => {
    const row = toneRow(hex);
    expect(row).toHaveLength(TONE_COUNT);
    expect(new Set(row).size).toBe(TONE_COUNT);

    const lightness = row.map((h) => toLab(h)[0]);
    for (let i = 1; i < lightness.length; i++) {
      expect(lightness[i - 1] - lightness[i]).toBeCloseTo(10, 0);
    }
    expect(Math.max(...lightness)).toBeLessThanOrEqual(TONE_MAX + 1.5);
    expect(Math.min(...lightness)).toBeGreaterThanOrEqual(TONE_MIN - 1.5);
  });

  it.each(HUES.map((h) => [h.name, h.hex]))("%s: contains Google's own color exactly once", (_name, hex) => {
    expect(toneRow(hex).filter((h) => h === hex)).toHaveLength(1);
  });

  it("is stable", () => {
    expect(toneRow("#8e24aa")).toEqual(toneRow("#8e24aa"));
  });

  it("keeps the hue of a chromatic color across tones", () => {
    const hueOf = (hex) => Math.atan2(toLab(hex)[2], toLab(hex)[1]);
    const target = hueOf("#4285f4");
    for (const hex of toneRow("#4285f4")) {
      const diff = Math.abs(hueOf(hex) - target);
      expect(Math.min(diff, 2 * Math.PI - diff)).toBeLessThan(0.15);
    }
  });

  it("makes gray tones neutral", () => {
    for (const hex of toneRow("#616161")) {
      const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2));
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });
});

describe("fromLch", () => {
  it("returns the requested lightness when the color fits", () => {
    expect(toLab(fromLch(60, 30, 1))[0]).toBeCloseTo(60, 0);
  });

  it("lowers chroma instead of leaving the gamut", () => {
    const hex = fromLch(95, 120, 2);
    expect(normalizeHex(hex)).toBe(hex);
    expect(toLab(hex)[0]).toBeGreaterThan(90);
  });
});

describe("classic colors", () => {
  it("has ids 1 to 11 and unique hexes", () => {
    expect(CLASSIC_COLORS.map((c) => c.id)).toEqual(Array.from({ length: 11 }, (_, i) => String(i + 1)));
    expect(new Set(CLASSIC_COLORS.map((c) => c.hex)).size).toBe(11);
  });

  it("includes the default Grape", () => {
    expect(classicIdFor("#8e24aa")).toBe("3");
    expect(classicIdFor("#123abc")).toBeNull();
  });

  it("finds the nearest classic color for any hex", () => {
    expect(nearestClassic("#3f51b5").id).toBe("9");
    expect(nearestClassic("#8f2cae").id).toBe("3");
    expect(nearestClassic("#d00505").id).toBe("11");
  });
});

describe("hueIndexOf", () => {
  it("finds the chip whose tone row holds the color", () => {
    HUES.forEach((hue, i) => {
      for (const tone of toneRow(hue.hex)) expect(hueIndexOf(tone)).toBe(i);
    });
  });

  it("falls back to the nearest hue for a color outside every row", () => {
    expect(HUES[hueIndexOf("#2060f0")].name).toBe("Blue");
    expect(HUES[hueIndexOf("#7a7a7a")].name).toBe("Gray");
  });
});
