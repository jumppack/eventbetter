// Hard rule from the spec: no Google user data may reach the ad SDK. These
// checks keep the ad code structurally unable to see it.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../..");
const ADS = path.join(SRC, "ads");

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });

const importsOf = (file) =>
  [...fs.readFileSync(file, "utf8").matchAll(/(?:import[^"']*from\s*|require\()\s*["']([^"']+)["']/g)].map(
    (m) => m[1],
  );

const ALLOWED_PACKAGES = ["react", "react-native", "react-native-google-mobile-ads", "expo-constants"];

describe("ad code isolation", () => {
  const adFiles = sourceFiles(ADS);

  it("finds the ad module", () => {
    expect(adFiles.length).toBeGreaterThan(0);
  });

  it.each(adFiles.map((f) => [path.relative(SRC, f), f]))(
    "%s only imports ad-safe modules",
    (_name, file) => {
      for (const spec of importsOf(file)) {
        if (spec.startsWith(".")) {
          const target = path.resolve(path.dirname(file), spec);
          const insideAds = target.startsWith(ADS + path.sep);
          const isAdConfig = target === path.join(SRC, "config", "admob.json");
          expect({ spec, allowed: insideAds || isAdConfig }).toEqual({ spec, allowed: true });
        } else {
          expect(ALLOWED_PACKAGES).toContain(spec);
        }
      }
    },
  );

  it("is the only place that imports the ad SDK", () => {
    const outside = sourceFiles(SRC).filter(
      (f) => !f.startsWith(ADS + path.sep) && importsOf(f).includes("react-native-google-mobile-ads"),
    );
    expect(outside.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("passes no targeting or user content to ad requests", () => {
    const code = adFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(code).not.toMatch(/keywords\s*:|contentUrl|neighboringContentUrls|customTargeting|publisherProvidedId/);
  });
});
