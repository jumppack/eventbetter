import {
  buildOccurrences,
  decodeConfig,
  encodeConfig,
  keyFor,
  planSeries,
  propertiesFor,
  PropertyTooLargeError,
  sameExceptColor,
  toSeriesEvent,
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

describe("buildOccurrences numbering", () => {
  const view = (sub) => buildOccurrences(sub).map((o) => `${toDateString(o.date)} ${o.title}`);
  const ends = (list) => [list[0], list[1], list.at(-1)];

  it("puts the 1st occurrence on the start date when starting there", () => {
    const pay = { ...gym, name: "Rent", start: "2026-06-01", maxCount: 10, starting: "start", title: "{name}: {ord} payment done" };
    expect(ends(view(pay))).toEqual([
      "2026-06-01 Rent: 1st payment done",
      "2026-07-01 Rent: 2nd payment done",
      "2027-03-01 Rent: 10th payment done",
    ]);
  });

  it("counts down from the total", () => {
    const list = view({ ...gym, direction: "down", title: "{name}: {count} {units} left" });
    expect(ends(list)).toEqual([
      "2026-10-30 Tuff Gym membership: 12 months left",
      "2026-11-30 Tuff Gym membership: 11 months left",
      "2027-09-30 Tuff Gym membership: 1 month left",
    ]);
  });

  it("counts down from the number left after the end date cuts the series short", () => {
    const list = buildOccurrences({ ...gym, direction: "down", end: "2027-01-15" });
    expect(list.map((o) => o.number)).toEqual([3, 2, 1]);
  });

  it("countdown from the start date adds the end event one period after the last", () => {
    const list = view({
      ...gym,
      start: "2026-10-30",
      direction: "down",
      starting: "start",
      title: "{name}: {count} {units} remaining",
      endTitle: "{name} ended",
    });
    expect(list).toHaveLength(13);
    expect([list[0], list[11], list[12]]).toEqual([
      "2026-10-30 Tuff Gym membership: 12 months remaining",
      "2027-09-30 Tuff Gym membership: 1 month remaining",
      "2027-10-30 Tuff Gym membership ended",
    ]);
  });

  it("the end title renames the last occurrence when it's already on the end date", () => {
    const list = buildOccurrences({ ...gym, endTitle: "{name}: done after {count} {units}" });
    expect(list).toHaveLength(12);
    expect(list.at(-1)).toMatchObject({ numbered: true, title: "Tuff Gym membership: done after 12 months" });
  });

  it("the start title renames the 1st occurrence when it's on the start date", () => {
    const list = buildOccurrences({ ...gym, starting: "start", startTitle: "{name} started" });
    expect(list).toHaveLength(12);
    expect(list[0]).toMatchObject({ numbered: true, title: "Tuff Gym membership started" });
    expect(toDateString(list[0].date)).toBe("2026-09-30");
  });

  it("keeps start and end events off a series with no numbered occurrences", () => {
    const list = buildOccurrences({ ...gym, end: "2026-10-01", startTitle: "{name} started", endTitle: "{name} ended" });
    expect(list.map((o) => o.title)).toEqual(["Tuff Gym membership started"]);
  });

  it("marks extra events as not numbered", () => {
    const list = buildOccurrences({ ...gym, maxCount: 2, startTitle: "{name} started" });
    expect(list.map((o) => [o.step, o.numbered])).toEqual([[0, false], [1, true], [2, true]]);
  });

  it("clamps month ends from the original start date in both starting modes", () => {
    const jan31 = { ...gym, start: "2027-01-31", maxCount: 3 };
    expect(buildOccurrences(jan31).map((o) => toDateString(o.date))).toEqual(["2027-02-28", "2027-03-31", "2027-04-30"]);
    expect(buildOccurrences({ ...jan31, starting: "start" }).map((o) => toDateString(o.date))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
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

  it("starts on the start date when the 1st occurrence is there", () => {
    const plan = planSeries({ ...gym, starting: "start", endTitle: "{name} ended" });
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
  it("round-trips normalized settings", () => {
    const sub = { ...gym, end: "2027-06-01", startTitle: "{name} started", direction: "down", starting: "start", endTitle: "{name} ended" };
    expect(decodeConfig(encodeConfig(sub))).toEqual(sub);
  });

  it("is compact JSON", () => {
    expect(encodeConfig(gym)).not.toMatch(/\n| {2}/);
  });

  it("reads version 1 settings as counting up from one period later", () => {
    const v1 = '{"v":1,"name":"Gym","start":"2026-09-30","frequency":"monthly","interval":1,"end":"","maxCount":12,"title":"{name}: {ord} {unit} over","startTitle":"","description":""}';
    expect(decodeConfig(v1)).toMatchObject({ direction: "up", starting: "later", endTitle: "" });
    const items = buildOccurrences(normalize(decodeConfig(v1)));
    expect(toDateString(items[0].date)).toBe("2026-10-30");
    expect(items[0].title).toBe("Gym: 1st month over");
  });

  it("rejects unknown versions", () => {
    expect(() => decodeConfig('{"v":99}')).toThrow(/version/);
  });
});

describe("color in the saved settings", () => {
  it("round-trips, and is not part of the duplicate key", () => {
    const blue = { ...gym, color: "#4285f4" };
    expect(decodeConfig(encodeConfig(blue)).color).toBe("#4285f4");
    expect(keyFor(blue)).toBe(keyFor(gym));
  });

  it("reads settings saved before colors existed as 'no color'", () => {
    const v2 = JSON.stringify({ v: 2, ...gym, color: undefined });
    expect(decodeConfig(v2).color).toBe("");
    expect(normalize(decodeConfig(v2)).color).toBe("");
  });

  it("stays version 2, so older app versions can still read it", () => {
    expect(JSON.parse(encodeConfig(gym)).v).toBe(2);
  });
});

describe("toSeriesEvent color fields", () => {
  const plan = planSeries(gym);

  it("adds the label or classic color it is given", () => {
    expect(toSeriesEvent(plan, { eventLabelId: "u1" }).eventLabelId).toBe("u1");
    expect(toSeriesEvent(plan, { colorId: "3" }).colorId).toBe("3");
  });

  it("adds nothing by default", () => {
    const event = toSeriesEvent(plan);
    expect(event).not.toHaveProperty("eventLabelId");
    expect(event).not.toHaveProperty("colorId");
  });
});

describe("propertiesFor / sameExceptColor", () => {
  it("builds the same properties planSeries attaches", () => {
    expect(propertiesFor(gym)).toEqual(planSeries(gym).properties);
  });

  it("tells a color-only change from any other", () => {
    expect(sameExceptColor(gym, { ...gym, color: "#4285f4" })).toBe(true);
    expect(sameExceptColor(gym, { ...gym })).toBe(true);
    expect(sameExceptColor(gym, { ...gym, title: "x" })).toBe(false);
    expect(sameExceptColor(gym, { ...gym, color: "#4285f4", endTitle: "ended" })).toBe(false);
    expect(sameExceptColor(gym, { ...gym, maxCount: 6 })).toBe(false);
  });
});
