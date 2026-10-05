import { MAX_REMINDERS } from "../../config/defaults";
import { planReminders, reminderTime } from "../reminders";
import { parseDate, toDateString } from "../schedule";
import { normalize } from "../validate";

const sub = (id, input, extra = {}) => ({
  id,
  name: input.name,
  editable: true,
  config: normalize(input),
  ...extra,
});

const gym = sub("gym", { name: "Tuff Gym membership", start: "2026-09-30" });
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const local = (date) => `${toDateString(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

describe("reminderTime", () => {
  it("is 9:00 AM local the day before", () => {
    expect(local(reminderTime(parseDate("2026-10-30")))).toBe("2026-10-29 09:00");
  });

  it("crosses month and year boundaries", () => {
    expect(local(reminderTime(parseDate("2027-03-01")))).toBe("2027-02-28 09:00");
    expect(local(reminderTime(parseDate("2028-03-01")))).toBe("2028-02-29 09:00");
    expect(local(reminderTime(parseDate("2027-01-01")))).toBe("2026-12-31 09:00");
  });

  it("stays at 9:00 on days when clocks change", () => {
    // US DST starts 2027-03-14, NZ DST ends 2027-04-04; IST and UTC have none.
    for (const day of ["2027-03-15", "2027-04-05", "2027-11-08", "2027-09-27"]) {
      expect(reminderTime(parseDate(day)).getHours()).toBe(9);
    }
  });
});

describe("planReminders", () => {
  it("schedules the next two occurrences, with the spec's body text", () => {
    const plan = planReminders([gym], at(2026, 10, 4, 12));
    expect(plan.map((r) => [r.key, local(r.fireAt), r.title, r.body])).toEqual([
      ["gym|2026-10-30", "2026-10-29 09:00", "Tuff Gym membership", "Tomorrow: Tuff Gym membership: 1st month over"],
      ["gym|2026-11-30", "2026-11-29 09:00", "Tuff Gym membership", "Tomorrow: Tuff Gym membership: 2nd month over"],
    ]);
  });

  it("skips a reminder whose time has already passed", () => {
    const before = planReminders([gym], at(2026, 10, 29, 8, 59));
    expect(before[0].key).toBe("gym|2026-10-30");
    const after = planReminders([gym], at(2026, 10, 29, 9, 0));
    expect(after.map((r) => r.key)).toEqual(["gym|2026-11-30", "gym|2026-12-30"]);
  });

  it("includes the start event when it's still ahead", () => {
    const withStart = sub("s", { name: "Gym", start: "2026-10-10", startTitle: "{name} started" });
    expect(planReminders([withStart], at(2026, 10, 4))[0].body).toBe("Tomorrow: Gym started");
  });

  it("schedules nothing for completed or uneditable series", () => {
    const done = sub("old", { name: "Old", start: "2020-01-01", maxCount: "3" });
    const unreadable = { id: "x", name: "X", editable: false, config: null };
    expect(planReminders([done, unreadable], at(2026, 10, 4))).toEqual([]);
  });

  it("orders across series by time", () => {
    const weekly = sub("w", { name: "Yoga", start: "2026-10-01", frequency: "weekly" });
    const plan = planReminders([gym, weekly], at(2026, 10, 4));
    expect(plan.map((r) => r.key)).toEqual(["w|2026-10-08", "w|2026-10-15", "gym|2026-10-30", "gym|2026-11-30"]);
  });

  it(`caps the total at ${MAX_REMINDERS}, keeping the soonest`, () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      sub(`s${i}`, { name: `Sub ${i}`, start: "2026-10-01", frequency: "daily", interval: String(i + 1) }),
    );
    const plan = planReminders(many, at(2026, 10, 4, 12));
    expect(plan).toHaveLength(MAX_REMINDERS);
    for (let i = 1; i < plan.length; i++) expect(plan[i].fireAt >= plan[i - 1].fireAt).toBe(true);
  });
});
