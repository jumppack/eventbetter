import { parseDate, toDateString } from "../schedule";
import { buildOccurrences } from "../series";
import { compareSeries, describeFrequency, summarize } from "../summary";
import { normalize } from "../validate";

const gym = normalize({ name: "Tuff Gym membership", start: "2026-09-30" });

describe("describeFrequency", () => {
  it.each([
    ["monthly", 1, "Every month"],
    ["monthly", 3, "Every 3 months"],
    ["weekly", 1, "Every week"],
    ["weekly", 2, "Every 2 weeks"],
    ["daily", 1, "Every day"],
    ["yearly", 2, "Every 2 years"],
  ])("%s every %i -> %s", (frequency, interval, expected) => {
    expect(describeFrequency({ frequency, interval })).toBe(expected);
  });
});

describe("summarize", () => {
  const items = buildOccurrences(gym); // Oct 30, 2026 … Sep 30, 2027

  it("before the first occurrence: 0 done, next is the first", () => {
    const s = summarize(items, parseDate("2026-10-04"));
    expect(s).toMatchObject({ done: 0, total: 12, completed: false });
    expect(toDateString(s.next.date)).toBe("2026-10-30");
    expect(s.next.title).toBe("Tuff Gym membership: 1st month over");
  });

  it("counts an occurrence dated today as done", () => {
    const s = summarize(items, parseDate("2027-02-28"));
    expect(s.done).toBe(5);
    expect(toDateString(s.next.date)).toBe("2027-03-30");
  });

  it("is completed after the last occurrence", () => {
    const s = summarize(items, parseDate("2027-10-01"));
    expect(s).toEqual({ done: 12, total: 12, next: null, completed: true });
  });

  it("doesn't count the start event toward progress but shows it as next", () => {
    const withStart = buildOccurrences({ ...gym, startTitle: "{name} started" });
    const s = summarize(withStart, parseDate("2026-09-29"));
    expect(s).toMatchObject({ done: 0, total: 12 });
    expect(s.next.title).toBe("Tuff Gym membership started");
  });

  it("uses the local date, whatever the time of day", () => {
    // 23:59 local on the occurrence date still counts it as done.
    const lateNight = new Date(2026, 9, 30, 23, 59);
    expect(summarize(items, lateNight).done).toBe(1);
    const earlyMorning = new Date(2026, 9, 30, 0, 1);
    expect(summarize(items, earlyMorning).done).toBe(1);
  });
});

describe("compareSeries", () => {
  const sub = (name, next, completed = false) => ({
    name,
    completed,
    next: next && { date: parseDate(next) },
  });

  it("sorts by next date, completed last, then name", () => {
    const list = [
      sub("Done", null, true),
      sub("Later", "2027-01-01"),
      sub("B soon", "2026-11-01"),
      sub("A soon", "2026-11-01"),
    ].sort(compareSeries);
    expect(list.map((s) => s.name)).toEqual(["A soon", "B soon", "Later", "Done"]);
  });
});
