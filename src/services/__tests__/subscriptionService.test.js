import { createFakeCalendarApi, createMemoryStorage } from "../../../jest/fakeCalendarApi";
import { WRITE_DELAY_MS } from "../../config/defaults";
import { ValidationError } from "../../lib/validate";
import {
  createSubscriptionService,
  SeriesExistsError,
  SeriesMismatchError,
} from "../subscriptionService";

const gym = { name: "Tuff Gym membership", start: "2026-09-30" };

function setup({ storage = createMemoryStorage(), canListCalendars = true, calendarList } = {}) {
  const api = createFakeCalendarApi({ calendarList });
  const sleeps = [];
  const service = createSubscriptionService({
    api,
    storage,
    canListCalendars,
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { api, storage, service, sleeps };
}

const titlesOf = async (api, calendarId, seriesId) =>
  (await api.listInstances(calendarId, seriesId)).map((i) => `${i.start.date}: ${i.summary}`);

describe("create", () => {
  it("creates the spec example with a numbered title on every occurrence", async () => {
    const { api, service } = setup();
    const result = await service.create(gym);

    expect(result.count).toBe(12);
    const titles = await titlesOf(api, result.calendarId, result.seriesId);
    expect(titles).toHaveLength(12);
    expect(titles[0]).toBe("2026-10-30: Tuff Gym membership: 1st month over");
    expect(titles[1]).toBe("2026-11-30: Tuff Gym membership: 2nd month over");
    expect(titles[4]).toBe("2027-02-28: Tuff Gym membership: 5th month over");
    expect(titles[11]).toBe("2027-09-30: Tuff Gym membership: 12th month over");
  });

  it("writes the series with the reminder, RRULE and tags", async () => {
    const { api, service } = setup();
    await service.create(gym);

    const [, , body] = api.calls.find(([name]) => name === "insertEvent");
    expect(body.start).toEqual({ date: "2026-10-30" });
    expect(body.end).toEqual({ date: "2026-10-31" });
    expect(body.recurrence).toEqual([
      "RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30;BYSETPOS=-1;COUNT=12",
    ]);
    expect(body.reminders).toEqual({
      useDefault: false,
      overrides: [{ method: "popup", minutes: 900 }],
    });
    expect(body.extendedProperties.private).toMatchObject({
      ebKey: "Tuff Gym membership|2026-09-30|monthly|1",
      ebName: "Tuff Gym membership",
    });
    expect(JSON.parse(body.extendedProperties.private.ebConfig)).toMatchObject({ v: 1, ...gym });
  });

  it("patches every occurrence except the first, throttled between writes", async () => {
    const { api, service, sleeps } = setup();
    await service.create(gym);

    expect(api.calls.filter(([name]) => name === "patchEvent")).toHaveLength(11);
    expect(sleeps).toEqual(Array(10).fill(WRITE_DELAY_MS));
  });

  it("includes the start event as the first occurrence", async () => {
    const { api, service } = setup();
    const result = await service.create({ ...gym, startTitle: "{name} started", maxCount: "2" });
    expect(await titlesOf(api, result.calendarId, result.seriesId)).toEqual([
      "2026-09-30: Tuff Gym membership started",
      "2026-10-30: Tuff Gym membership: 1st month over",
      "2026-11-30: Tuff Gym membership: 2nd month over",
    ]);
  });

  it("reports progress through every phase", async () => {
    const { service } = setup();
    const events = [];
    await service.create({ ...gym, maxCount: "3" }, { onProgress: (p) => events.push(p) });
    expect(events).toEqual([
      { phase: "preparing", done: 0, total: 3 },
      { phase: "creating", done: 0, total: 3 },
      { phase: "renaming", done: 1, total: 3 },
      { phase: "renaming", done: 2, total: 3 },
      { phase: "renaming", done: 3, total: 3 },
      { phase: "done", done: 3, total: 3 },
    ]);
  });

  it("refuses to create a duplicate, even though renamed occurrences carry the same key", async () => {
    const { api, service } = setup();
    await service.create(gym);
    await expect(service.create(gym)).rejects.toThrow(SeriesExistsError);
    expect(api.calls.filter(([name]) => name === "insertEvent")).toHaveLength(1);
  });

  it("finds the series master, not a renamed occurrence", async () => {
    const { service } = setup();
    const { calendarId, seriesId } = await service.create(gym);
    const found = await service.findSeriesByKey(calendarId, "Tuff Gym membership|2026-09-30|monthly|1");
    expect(found.id).toBe(seriesId);
  });

  it("allows the same name with a different start date", async () => {
    const { service } = setup();
    await service.create(gym);
    await expect(service.create({ ...gym, start: "2026-10-01" })).resolves.toBeDefined();
  });

  it("validates before touching the API", async () => {
    const { api, service } = setup();
    await expect(service.create({ name: "", start: "" })).rejects.toThrow(ValidationError);
    expect(api.calls).toEqual([]);
  });

  it("deletes the series and fails if Google's dates differ from the plan", async () => {
    const { api, service } = setup();
    const real = api.listInstances;
    api.listInstances = async (...args) => (await real(...args)).slice(0, -1);

    await expect(service.create(gym)).rejects.toThrow(SeriesMismatchError);
    expect(api.calls.some(([name]) => name === "patchEvent")).toBe(false);
    expect(api.calls.at(-1)[0]).toBe("deleteEvent");
  });

  it("deletes the half-renamed series if a patch fails", async () => {
    const { api, service } = setup();
    let patches = 0;
    const real = api.patchEvent;
    api.patchEvent = async (...args) => {
      if (++patches === 4) throw Object.assign(new Error("Forbidden"), { status: 403 });
      return real(...args);
    };

    await expect(service.create(gym)).rejects.toThrow("Forbidden");
    const [, calendarId] = api.calls.find(([name]) => name === "insertEvent");
    expect(await api.listEvents(calendarId)).toEqual([]);
  });
});

describe("ensureCalendar", () => {
  it("creates the EventBetter calendar once and remembers its ID", async () => {
    const { api, storage, service } = setup();
    const first = await service.ensureCalendar();
    const second = await service.ensureCalendar();

    expect(second).toBe(first);
    expect(storage.data.get("eventbetter.calendarId")).toBe(first);
    expect(api.calls.filter(([name]) => name === "insertCalendar")).toHaveLength(1);
    expect(api.calendars.get(first).summary).toBe("EventBetter");
  });

  it("recovers the calendar from the calendar list after a reinstall", async () => {
    const calendarList = [];
    const before = setup({ calendarList });
    const id = await before.service.ensureCalendar();

    const after = createSubscriptionService({
      api: before.api,
      storage: createMemoryStorage(),
      canListCalendars: true,
    });
    expect(await after.ensureCalendar()).toBe(id);
  });

  it("ignores a user-made calendar that happens to be named EventBetter", async () => {
    const calendarList = [
      { id: "theirs", summary: "EventBetter", description: "", accessRole: "owner" },
      { id: "shared", summary: "EventBetter", description: "x", accessRole: "reader" },
    ];
    const { service } = setup({ calendarList });
    const id = await service.ensureCalendar();
    expect(id).not.toBe("theirs");
    expect(id).not.toBe("shared");
  });

  it("recreates the calendar if the user deleted it", async () => {
    const { api, service } = setup();
    const first = await service.ensureCalendar();
    await api.deleteCalendar(first);

    const second = await service.ensureCalendar();
    expect(second).not.toBe(first);
    expect(api.calendars.has(second)).toBe(true);
  });

  it("creates a new calendar when the list scope isn't available and the ID is lost", async () => {
    const { api, service } = setup({
      canListCalendars: false,
      storage: createMemoryStorage({ "eventbetter.calendarId": "gone" }),
    });
    await service.ensureCalendar();
    expect(api.calls.some(([name]) => name === "listCalendarList")).toBe(false);
    expect(api.calls.filter(([name]) => name === "insertCalendar")).toHaveLength(1);
  });
});
