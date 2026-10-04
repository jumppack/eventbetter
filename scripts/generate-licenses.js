#!/usr/bin/env node
// Writes src/config/licenses.json for the open-source licenses screen.
//
// JS packages come from the Android bundle's source map, so the list holds
// what actually ships rather than every build tool in node_modules. Native
// Android libraries the app adds itself are listed by hand below.
//
// Run after adding or upgrading a dependency: npm run licenses

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/config/licenses.json");

const NATIVE = [
  { name: "androidx.credentials:credentials", license: "Apache-2.0", url: "https://developer.android.com/jetpack/androidx/releases/credentials" },
  { name: "androidx.credentials:credentials-play-services-auth", license: "Apache-2.0", url: "https://developer.android.com/jetpack/androidx/releases/credentials" },
  { name: "com.google.android.libraries.identity.googleid:googleid", license: "Android Software Development Kit License", url: "https://developer.android.com/studio/terms" },
  { name: "com.google.android.gms:play-services-auth", license: "Android Software Development Kit License", url: "https://developer.android.com/studio/terms" },
  { name: "org.jetbrains.kotlinx:kotlinx-coroutines-play-services", license: "Apache-2.0", url: "https://github.com/Kotlin/kotlinx.coroutines" },
];

function bundledPackageDirs() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "eventbetter-licenses-"));
  execFileSync("npx", ["expo", "export", "--platform", "android", "--dump-sourcemap", "--output-dir", outDir], {
    cwd: ROOT,
    stdio: "ignore",
  });
  const mapFile = findFile(outDir, (f) => f.endsWith(".map"));
  const { sources } = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  fs.rmSync(outDir, { recursive: true, force: true });

  const dirs = new Set();
  for (const source of sources) {
    // Innermost node_modules segment wins, so nested copies are found too.
    const match = source.match(/^(.*node_modules\/)(@[^/]+\/[^/]+|[^@/][^/]*)/);
    // Sources are project-relative paths with a leading slash.
    if (match) dirs.add(path.join(ROOT, match[1] + match[2]));
  }
  return [...dirs];
}

function findFile(dir, test) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, test);
      if (found) return found;
    } else if (test(full)) return full;
  }
  return null;
}

function licenseText(dir) {
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  return file ? fs.readFileSync(path.join(dir, file), "utf8").trim() : null;
}

function main() {
  const packages = new Map();
  for (const dir of bundledPackageDirs()) {
    const pkgFile = path.join(dir, "package.json");
    if (!fs.existsSync(pkgFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
    if (pkg.private || !pkg.name) continue; // our own local module
    const key = `${pkg.name}@${pkg.version}`;
    const license = typeof pkg.license === "string" ? pkg.license : pkg.license?.type ?? "See package";
    packages.set(key, { name: pkg.name, version: pkg.version, license, text: licenseText(dir) });
  }

  // Many packages share identical license text; store each text once.
  const texts = [];
  const textIndex = new Map();
  const list = [...packages.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ text, ...rest }) => {
      if (!text) return rest;
      if (!textIndex.has(text)) {
        textIndex.set(text, texts.length);
        texts.push(text);
      }
      return { ...rest, textId: textIndex.get(text) };
    });

  fs.writeFileSync(OUT, JSON.stringify({ packages: list, native: NATIVE, texts }) + "\n");
  console.log(`Wrote ${list.length} JS packages, ${NATIVE.length} native libraries, ${texts.length} unique texts to ${path.relative(ROOT, OUT)}`);
}

main();
