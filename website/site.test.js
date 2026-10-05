// Guards the website content that Google OAuth verification, Play and AdMob
// depend on. Runs with the app's Jest suite.
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC = path.join(__dirname, "public");
const read = (rel) => fs.readFileSync(path.join(PUBLIC, rel), "utf8");
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:])/g, "$1"); // tags removed before punctuation leave a space

const pages = ["index.html", "404.html", "eventbetter/index.html", "eventbetter/privacy/index.html"];

describe("app-ads.txt", () => {
  it("lists the AdMob publisher from the production app ID", () => {
    const { androidAppId } = require("../src/config/admob.json").production;
    const publisher = androidAppId.match(/^ca-app-pub-(\d+)~/)[1];
    expect(read("app-ads.txt").trim()).toBe(`google.com, pub-${publisher}, DIRECT, f08c47fec0942fa0`);
  });
});

describe("privacy policy", () => {
  const policy = text(read("eventbetter/privacy/index.html"));

  it.each([
    ["names both Calendar scopes", /calendar\.app\.created[\s\S]*calendar\.calendarlist\.readonly/],
    ["explains why each is needed", /only to find its own calendar again/],
    ["states there is no server", /no server/i],
    ["says Google data is never used for advertising", /Google user data is never used for advertising/],
    ["lists what AdMob collects", /advertising ID[\s\S]*IP address/],
    ["explains how to revoke access", /myaccount\.google\.com\/connections|third-party connections/],
    [
      "includes the Limited Use statement",
      /use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements/,
    ],
    ["has a contact email", /support@jumppack\.online/],
    ["has an effective date", /Effective \w+ \d{1,2}, \d{4}/],
  ])("%s", (_name, pattern) => {
    expect(policy).toMatch(pattern);
  });

  it("links the Limited Use requirements", () => {
    expect(read("eventbetter/privacy/index.html")).toContain(
      "https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes",
    );
  });
});

describe("homepage", () => {
  const home = read("eventbetter/index.html");

  it("names the app exactly as on the OAuth consent screen and links the policy", () => {
    expect(text(home)).toMatch(/EventBetter/);
    expect(home).toContain('href="/eventbetter/privacy/"');
  });

  it("explains what the app does with Calendar data", () => {
    expect(text(home)).toMatch(/only creates and changes events in that calendar/);
  });
});

describe.each(pages)("%s", (page) => {
  const html = read(page);

  it("is a complete, mobile-friendly page", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<meta name="viewport"/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  it("only links to files that exist", () => {
    const internal = [...html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)].map((m) => m[1]);
    for (const url of internal) {
      const file = url.endsWith("/") ? `${url}index.html` : url;
      expect({ url, exists: fs.existsSync(path.join(PUBLIC, file)) }).toEqual({ url, exists: true });
    }
  });

  it("uses the current terminology", () => {
    expect(text(html)).not.toMatch(/subscription/i);
  });
});
