import { rrule } from "../rrule";

describe("rrule", () => {
  it("builds a plain rule with FREQ, INTERVAL and COUNT", () => {
    expect(rrule({ start: "2026-01-15", frequency: "monthly", interval: 3, count: 4 })).toBe(
      "RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=4",
    );
    expect(rrule({ start: "2026-01-15", frequency: "weekly", interval: 2, count: 10 })).toBe(
      "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10",
    );
    expect(rrule({ start: "2026-01-31", frequency: "daily", interval: 1, count: 5 })).toBe(
      "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
    );
  });

  it("never uses UNTIL", () => {
    for (const frequency of ["daily", "weekly", "monthly", "yearly"]) {
      expect(rrule({ start: "2026-01-31", frequency, interval: 1, count: 3 })).not.toMatch(/UNTIL/);
    }
  });

  it("leaves monthly rules alone up to the 28th", () => {
    expect(rrule({ start: "2026-02-28", frequency: "monthly", interval: 1, count: 12 })).toBe(
      "RRULE:FREQ=MONTHLY;INTERVAL=1;COUNT=12",
    );
  });

  it.each([
    ["2026-01-29", "28,29"],
    ["2026-01-30", "28,29,30"],
    ["2026-01-31", "28,29,30,31"],
  ])("clamps monthly rules starting %s to month end", (start, days) => {
    expect(rrule({ start, frequency: "monthly", interval: 1, count: 12 })).toBe(
      `RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${days};BYSETPOS=-1;COUNT=12`,
    );
  });

  it("clamps yearly rules starting Feb 29", () => {
    expect(rrule({ start: "2028-02-29", frequency: "yearly", interval: 1, count: 5 })).toBe(
      "RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1;COUNT=5",
    );
  });

  it("does not clamp yearly rules on other month ends", () => {
    expect(rrule({ start: "2026-01-31", frequency: "yearly", interval: 1, count: 5 })).toBe(
      "RRULE:FREQ=YEARLY;INTERVAL=1;COUNT=5",
    );
  });
});
