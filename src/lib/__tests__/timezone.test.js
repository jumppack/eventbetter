import { planSeries } from "../series";
import { addDays, addUnits, isValidDateString, parseDate, toDateString } from "../schedule";
import { normalize } from "../validate";

// Offsets in minutes east of UTC, as getTimezoneOffset() reports them negated.
const OFFSETS = {
  "Asia/Kolkata": { jan: 330, jul: 330 },
  UTC: { jan: 0, jul: 0 },
  "America/Los_Angeles": { jan: -480, jul: -420 },
  "Pacific/Auckland": { jan: 780, jul: 720 },
};

const tz = globalThis.__TEST_TZ__;

describe(`running in ${tz}`, () => {
  it("actually applies the configured time zone", () => {
    expect(0 - new Date(2026, 0, 15).getTimezoneOffset()).toBe(OFFSETS[tz].jan);
    expect(0 - new Date(2026, 6, 15).getTimezoneOffset()).toBe(OFFSETS[tz].jul);
  });

  it("round-trips every day of a leap year through parseDate/toDateString", () => {
    const bad = [];
    for (let d = new Date(2028, 0, 1); d.getFullYear() === 2028; d = addDays(d, 1)) {
      const s = toDateString(d);
      if (toDateString(parseDate(s)) !== s || !isValidDateString(s)) bad.push(s);
    }
    expect(bad).toEqual([]);
  });

  it("keeps every generated date at local midnight", () => {
    const plan = planSeries(
      normalize({ name: "Sub", start: "2027-01-31", startTitle: "{name} started", maxCount: 24 }),
    );
    const notMidnight = plan.items.filter(({ date }) => date.getHours() !== 0 || date.getMinutes() !== 0);
    expect(notMidnight).toEqual([]);
  });
});

// These only mean something when the offset is positive and not a whole hour,
// so they run in IST only.
const describeIST = tz === "Asia/Kolkata" ? describe : describe.skip;

describeIST("IST (+05:30) specifics", () => {
  it("would expose toISOString() on a local date as the previous day", () => {
    // Guards the premise of the tests below: the naive approach is wrong here.
    const localMidnight = parseDate("2026-09-30");
    expect(localMidnight.toISOString().slice(0, 10)).toBe("2026-09-29");
    expect(toDateString(localMidnight)).toBe("2026-09-30");
  });

  it("would expose new Date('YYYY-MM-DD') as 05:30, not midnight", () => {
    expect(new Date("2026-09-30").getHours()).toBe(5);
    expect(new Date("2026-09-30").getMinutes()).toBe(30);
    expect(parseDate("2026-09-30").getHours()).toBe(0);
  });

  it("produces the spec example dates unchanged", () => {
    const plan = planSeries(normalize({ name: "Tuff Gym membership", start: "2026-09-30" }));
    expect(toDateString(plan.firstDate)).toBe("2026-10-30");
    expect(plan.items.map((o) => toDateString(o.date))).toEqual([
      "2026-10-30",
      "2026-11-30",
      "2026-12-30",
      "2027-01-30",
      "2027-02-28",
      "2027-03-30",
      "2027-04-30",
      "2027-05-30",
      "2027-06-30",
      "2027-07-30",
      "2027-08-30",
      "2027-09-30",
    ]);
  });

  it("handles year-end and leap-day steps without shifting", () => {
    expect(toDateString(addUnits(parseDate("2027-12-31"), "daily", 1))).toBe("2028-01-01");
    expect(toDateString(addUnits(parseDate("2028-02-28"), "daily", 1))).toBe("2028-02-29");
    expect(toDateString(addUnits(parseDate("2028-02-29"), "yearly", 1))).toBe("2029-02-28");
    expect(toDateString(addUnits(parseDate("2026-12-31"), "monthly", 2))).toBe("2027-02-28");
  });
});
