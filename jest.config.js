// Every suite runs once per time zone. Date bugs (UTC parsing, toISOString on
// local dates) only show up when the offset is non-zero, and each zone below
// stresses a different case.
const TIME_ZONES = [
  "Asia/Kolkata", // IST, +05:30, no DST: local midnight is the previous UTC day
  "UTC",
  "America/Los_Angeles", // negative offset with DST
  "Pacific/Auckland", // +13 in southern summer, DST
];

module.exports = {
  projects: TIME_ZONES.map((tz) => ({
    displayName: tz,
    preset: "jest-expo",
    globals: { __TEST_TZ__: tz },
    testEnvironment: "<rootDir>/jest/timezone-environment.js",
  })),
};
