import {
  buildOccurrences,
  decodeConfig,
  encodeConfig,
  keyFor,
  planSeries,
  PropertyTooLargeError,
} from "../series";
import { toDateString } from "../schedule";
import { normalize } from "../validate";

const gym = normalize({ name: "Tuff Gym membership", start: "2026-09-30" });

describe("keyFor", () => {
  it("joins name, start, frequency and interval", () => {
    expect(keyFor(gym)).toBe("Tuff Gym membership|2026-09-30|monthly|1");
  });
});

describe("buildOccurrences", () => {
  it("produces the spec example titles and dates", () => {
    const items = buildOccurrences(gym);
    expect(items).toHaveLength(12);
    const view = items.map((o) => `${toDateString(o.date)}: ${o.title}`);
    expect(view[0]).toBe("2026-10-30: Tuff Gym membership: 1st month over");
    expect(view[1]).toBe("2026-11-30: Tuff Gym membership: 2nd month over");
    expect(view[4]).toBe("2027-02-28: Tuff Gym membership: 5th month over");
    expect(view[11]).toBe("2027-09-30: Tuff Gym membership: 12th month over");
  });

  it("prepends the start event as occurrence 0 on the start date", () => {
    const items = buildOccurrences({ ...gym, startTitle: "{name} started", maxCount: 2 });
    expect(items.map((o) => [o.n, toDateString(o.date), o.title])).toEqual([
      [0, "2026-09-30", "Tuff Gym membership started"],
      [1, "2026-10-30", "Tuff Gym membership: 1st month over"],
      [2, "2026-11-30", "Tuff Gym membership: 2nd month over"],
    ]);
  });

  it("fills the description template per occurrence", () => {
    const items = buildOccurrences({ ...gym, description: "{elapsed} {units} in", maxCount: 2 });
    expect(items.map((o) => o.description)).toEqual(["1 month in", "2 months in"]);
  });
});

describe("planSeries", () => {
  it("starts the series at the first occurrence and counts every item", () => {
    const plan = planSeries(gym);
    expect(toDateString(plan.firstDate)).toBe("2026-10-30");
    expect(plan.rrule).toBe("RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30;BYSETPOS=-1;COUNT=12");
    expect(plan.properties.ebKey).toBe(keyFor(gym));
    expect(plan.properties.ebName).toBe("Tuff Gym membership");
    expect(decodeConfig(plan.properties.ebConfig)).toEqual(gym);
  });

  it("includes the start event in COUNT and starts on the start date", () => {
    const plan = planSeries({ ...gym, startTitle: "{name} started" });
    expect(toDateString(plan.firstDate)).toBe("2026-09-30");
    expect(plan.rrule).toMatch(/COUNT=13$/);
  });

  it("allows a start event as the only occurrence", () => {
    const plan = planSeries({ ...gym, end: "2026-10-01", startTitle: "{name} started" });
    expect(plan.items).toHaveLength(1);
    expect(plan.rrule).toMatch(/COUNT=1$/);
  });

  it("fails when no events fall in range", () => {
    expect(() => planSeries({ ...gym, end: "2026-10-01" })).toThrow(
      "No events fall between the start and end dates",
    );
  });

  it("fails clearly when the config exceeds the property value limit", () => {
    expect(() => planSeries({ ...gym, title: "x".repeat(1000) })).toThrow(PropertyTooLargeError);
  });

  it("measures multi-byte characters conservatively", () => {
    // "🏋️" is 7 UTF-8 bytes but 3 UTF-16 units: 1050 bytes vs 450 units
    expect(() => planSeries({ ...gym, startTitle: "🏋️".repeat(150) })).toThrow(PropertyTooLargeError);
  });
});

describe("encodeConfig / decodeConfig", () => {
  it("round-trips a normalized subscription", () => {
    const sub = { ...gym, end: "2027-06-01", startTitle: "{name} started" };
    expect(decodeConfig(encodeConfig(sub))).toEqual(sub);
  });

  it("is compact JSON", () => {
    expect(encodeConfig(gym)).not.toMatch(/\n| {2}/);
  });

  it("rejects unknown versions", () => {
    expect(() => decodeConfig('{"v":99}')).toThrow(/version/);
  });
});
