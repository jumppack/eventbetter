// The app talks about recurring events and occurrences, never subscriptions
// (see CLAUDE.md, Terminology). The one allowed match is the old calendar
// description, kept so calendars made before the rename are still recognized.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "..");
const ALLOWED = ["Deleting this calendar deletes all its subscriptions."];

const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : files(full);
    return /\.(js|jsx)$/.test(e.name) ? [full] : [];
  });

it("never says subscription or subscribed in app code", () => {
  const hits = [];
  for (const file of files(SRC)) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/subscri(be|ption)/i.test(line) && !ALLOWED.some((ok) => line.includes(ok))) {
          hits.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  expect(hits).toEqual([]);
});
