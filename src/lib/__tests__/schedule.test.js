import {
  addUnits,
  isValidDateString,
  occurrences,
  parseDate,
  toDateString,
} from "../schedule";

const dates = (list) => list.map(({ date }) => toDateString(date));

describe("parseDate / toDateString", () => {
  it("parses as a local date without shifting the day", () => {
    const d = parseDate("2026-09-30");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 30]);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips", () => {
    expect(toDateString(parseDate("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("isValidDateString", () => {
  it.each(["2026-09-30", "2028-02-29"])("accepts %s", (s) => {
    expect(isValidDateString(s)).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-9-30", "", "abc", null])(
    "rejects %p",
    (s) => {
      expect(isValidDateString(s)).toBe(false);
    },
  );
});

describe("addUnits", () => {
  const jan31 = parseDate("2026-01-31");

  it("clamps monthly steps to month end, computed from the original date", () => {
    expect(toDateString(addUnits(jan31, "monthly", 1))).toBe("2026-02-28");
    expect(toDateString(addUnits(jan31, "monthly", 2))).toBe("2026-03-31");
    expect(toDateString(addUnits(jan31, "monthly", 3))).toBe("2026-04-30");
    expect(toDateString(addUnits(parseDate("2027-01-31"), "monthly", 1))).toBe("2027-02-28");
    expect(toDateString(addUnits(parseDate("2028-01-31"), "monthly", 1))).toBe("2028-02-29");
  });

  it("crosses year boundaries", () => {
    expect(toDateString(addUnits(parseDate("2026-11-30"), "monthly", 3))).toBe("2027-02-28");
  });

  it("clamps Feb 29 yearly to Feb 28 in non-leap years", () => {
    const feb29 = parseDate("2028-02-29");
    expect(toDateString(addUnits(feb29, "yearly", 1))).toBe("2029-02-28");
    expect(toDateString(addUnits(feb29, "yearly", 4))).toBe("2032-02-29");
  });

  it("adds days and weeks across DST changes without drifting", () => {
    // Clocks change in many zones in March/November; results must stay midnight-aligned dates.
    expect(toDateString(addUnits(parseDate("2026-03-01"), "daily", 30))).toBe("2026-03-31");
    expect(toDateString(addUnits(parseDate("2026-10-20"), "weekly", 2))).toBe("2026-11-03");
  });
});

describe("occurrences", () => {
  it("matches the spec example: monthly from 2026-09-30, 12 events", () => {
    const list = occurrences({
      start: "2026-09-30",
      frequency: "monthly",
      interval: 1,
      end: "",
      maxCount: 12,
    });
    expect(list.map(({ n }) => n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dates(list)).toEqual([
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

  it("applies the interval", () => {
    const list = occurrences({
      start: "2026-01-15",
      frequency: "monthly",
      interval: 3,
      maxCount: 4,
    });
    expect(dates(list)).toEqual(["2026-04-15", "2026-07-15", "2026-10-15", "2027-01-15"]);
  });

  it("stops at the end date when it comes first (inclusive)", () => {
    const list = occurrences({
      start: "2026-01-01",
      frequency: "weekly",
      interval: 1,
      end: "2026-01-29",
      maxCount: 12,
    });
    expect(dates(list)).toEqual(["2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]);
  });

  it("stops at maxCount when it comes first", () => {
    const list = occurrences({
      start: "2026-01-01",
      frequency: "daily",
      interval: 2,
      end: "2027-01-01",
      maxCount: 3,
    });
    expect(dates(list)).toEqual(["2026-01-03", "2026-01-05", "2026-01-07"]);
  });

  it("returns nothing when the end date is before the first occurrence", () => {
    expect(
      occurrences({ start: "2026-01-01", frequency: "yearly", interval: 1, end: "2026-06-01", maxCount: 5 }),
    ).toEqual([]);
  });
});
