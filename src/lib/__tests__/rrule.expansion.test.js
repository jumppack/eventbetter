// Cross-checks our RRULE strings against an independent RFC 5545 expander:
// the dates Google will generate must be exactly the dates we title.
// Google's own expansion is verified separately against the live API.
import { RRule } from "rrule";

import { addDays, toDateString } from "../schedule";
import { planSeries } from "../series";
import { normalize } from "../validate";

// rrule treats DTSTART as UTC "floating" time, so compare as plain date strings.
function expand(plan) {
  const dtstart = toDateString(plan.firstDate).replaceAll("-", "");
  const rule = RRule.fromString(`DTSTART:${dtstart}T000000Z\n${plan.rrule}`);
  return rule.all().map((d) => d.toISOString().slice(0, 10));
}

function mismatches(cases) {
  const failures = [];
  for (const input of cases) {
    const plan = planSeries(normalize({ name: "Sub", ...input }));
    const expected = plan.items.map((o) => toDateString(o.date));
    const actual = expand(plan);
    if (actual.join() !== expected.join()) {
      failures.push({ input, rrule: plan.rrule, expected, actual });
    }
  }
  return failures;
}

function everyDay(years) {
  const days = [];
  for (const year of years) {
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = addDays(d, 1)) {
      days.push(toDateString(d));
    }
  }
  return days;
}

// 2027 is a common year followed by leap year 2028, so series cross both.
const START_DAYS = everyDay([2027, 2028]);
// Where the 1st occurrence goes, and whether start and end titles add extra
// events on the grid, all change which dates the series covers.
const LAYOUTS = [];
for (const starting of ["later", "start"]) {
  for (const startTitle of ["", "{name} started"]) {
    for (const endTitle of ["", "{name} ended"]) {
      LAYOUTS.push({ starting, startTitle, endTitle });
    }
  }
}

function cases(frequency, intervals, maxCount, starts = START_DAYS) {
  const list = [];
  for (const start of starts) {
    for (const interval of intervals) {
      for (const layout of LAYOUTS) {
        list.push({ start, frequency, interval, maxCount, ...layout });
      }
    }
  }
  return list;
}

describe("RRULE expansion matches buildOccurrences()", () => {
  it("monthly, every start day in a common and a leap year", () => {
    expect(mismatches(cases("monthly", [1, 2, 3, 6, 12], 24))).toEqual([]);
  });

  it("yearly, every start day including Feb 29", () => {
    expect(mismatches(cases("yearly", [1, 2, 4], 12))).toEqual([]);
  });

  it("weekly, every start day", () => {
    expect(mismatches(cases("weekly", [1, 2, 4], 30))).toEqual([]);
  });

  it("daily, across month, year and leap-day boundaries", () => {
    const starts = ["2027-01-31", "2027-02-27", "2027-12-30", "2028-02-28", "2028-02-29"];
    expect(mismatches(cases("daily", [1, 3, 7], 60, starts))).toEqual([]);
  });

  it("stops at the end date via COUNT", () => {
    const monthEnds = everyDay([2027]).filter((s) => Number(s.slice(-2)) >= 29);
    const list = monthEnds.flatMap((start) =>
      LAYOUTS.map((layout) => ({ start, frequency: "monthly", interval: 1, maxCount: 24, end: "2028-12-31", ...layout })),
    );
    expect(mismatches(list)).toEqual([]);
  });

  it("uses the maximum event count", () => {
    expect(
      mismatches(
        LAYOUTS.map((layout) => ({ start: "2027-01-31", frequency: "monthly", interval: 1, maxCount: 500, ...layout })),
      ),
    ).toEqual([]);
  });
});
