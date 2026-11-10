import { DEFAULT_LABEL_HEXES, createFakeCalendarApi, createMemoryStorage } from "../../../jest/fakeCalendarApi";
import { WRITE_DELAY_MS } from "../../config/defaults";
import { ValidationError } from "../../lib/validate";
import { parseDate, toDateString } from "../../lib/schedule";
import {
  createSeriesService,
  OldSeriesNotRemovedError,
  SeriesExistsError,
  SeriesMismatchError,
} from "../seriesService";

const gym = { name: "Tuff Gym membership", start: "2026-09-30" };

function setup({
  storage = createMemoryStorage(),
  canListCalendars = true,
  calendarList,
  today = "2026-10-04",
  labelMode,
} = {}) {
  const api = createFakeCalendarApi({ calendarList, labelMode });
  const sleeps = [];
  const service = createSeriesService({
    api,
    storage,
    canListCalendars,
    sleep: async (ms) => void sleeps.push(ms),
    now: () => parseDate(today),
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
    expect(JSON.parse(body.extendedProperties.private.ebConfig)).toMatchObject({ v: 2, ...gym });
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

    const after = createSeriesService({
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

describe("list", () => {
  it("returns nothing, without creating a calendar, for a new user", async () => {
    const { api, service } = setup();
    expect(await service.list()).toEqual([]);
    expect(api.calls.some(([name]) => name === "insertCalendar")).toBe(false);
  });

  it("lists each series once with frequency, progress and next occurrence", async () => {
    const { service } = setup({ today: "2027-02-28" });
    await service.create(gym);
    await service.create({ name: "Netflix", start: "2026-01-15", interval: "3", maxCount: "4" });

    const list = await service.list();
    expect(list.map((s) => s.name)).toEqual(["Tuff Gym membership", "Netflix"]);

    const [gymSub, netflix] = list;
    expect(gymSub).toMatchObject({ editable: true, frequencyLabel: "Every month", done: 5, total: 12 });
    expect(toDateString(gymSub.next.date)).toBe("2027-03-30");
    expect(gymSub.next.title).toBe("Tuff Gym membership: 6th month over");
    expect(netflix).toMatchObject({ frequencyLabel: "Every 3 months", done: 4, total: 4, completed: true });
  });

  it("carries the saved form config for the edit screen", async () => {
    const { service } = setup();
    await service.create({ ...gym, startTitle: "{name} started" });
    const [sub] = await service.list();
    expect(sub.config).toMatchObject({ ...gym, startTitle: "{name} started", maxCount: 12 });
  });

  it("still lists a series whose config can't be read, but not as editable", async () => {
    const { api, service } = setup();
    const { calendarId, seriesId } = await service.create(gym);
    api.calls.length = 0;
    const event = (await api.listEvents(calendarId)).find((e) => e.id === seriesId);
    event.extendedProperties.private.ebConfig = "{broken";

    const [sub] = await service.list();
    expect(sub).toMatchObject({ id: seriesId, name: "Tuff Gym membership", editable: false });
  });
});

describe("get", () => {
  it("returns one subscription, or null once deleted", async () => {
    const { service } = setup();
    const { seriesId } = await service.create(gym);
    expect((await service.get(seriesId)).name).toBe("Tuff Gym membership");
    await service.remove(seriesId);
    expect(await service.get(seriesId)).toBeNull();
  });
});

describe("remove", () => {
  it("deletes the series master, removing every occurrence", async () => {
    const { api, service } = setup();
    const { calendarId, seriesId } = await service.create(gym);
    await service.remove(seriesId);
    expect(await api.listEvents(calendarId)).toEqual([]);
  });

  it("treats an already-deleted series as removed", async () => {
    const { service } = setup();
    const { seriesId } = await service.create(gym);
    await service.remove(seriesId);
    await expect(service.remove(seriesId)).resolves.toBeUndefined();
  });
});

describe("update", () => {
  it("replaces the series with one built from the edited config", async () => {
    const { service } = setup();
    const { seriesId } = await service.create(gym);
    const result = await service.update(seriesId, { ...gym, title: "{name} #{count}", maxCount: "3" });

    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(result.seriesId);
    expect(list[0].id).not.toBe(seriesId);
    expect(list[0].next.title).toBe("Tuff Gym membership #1");
    expect(list[0].total).toBe(3);
  });

  it("allows keeping the same name, start and frequency", async () => {
    const { service } = setup();
    const { seriesId } = await service.create(gym);
    await expect(service.update(seriesId, { ...gym, maxCount: "6" })).resolves.toBeDefined();
  });

  it("still refuses to collide with a different existing series", async () => {
    const { service } = setup();
    await service.create(gym);
    const { seriesId } = await service.create({ ...gym, name: "Other" });
    await expect(service.update(seriesId, gym)).rejects.toThrow(SeriesExistsError);
  });

  it("keeps the old series if creating the new one fails", async () => {
    const { api, service } = setup();
    const { seriesId } = await service.create(gym);
    api.patchEvent = async () => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    };

    await expect(service.update(seriesId, { ...gym, maxCount: "3" })).rejects.toThrow("Forbidden");
    const list = await service.list();
    expect(list.map((s) => s.id)).toEqual([seriesId]);
  });

  it("reports when the new series was saved but the old one couldn't be removed", async () => {
    const { api, service } = setup();
    const { seriesId } = await service.create(gym);
    const realDelete = api.deleteEvent;
    api.deleteEvent = async (calendarId, eventId) => {
      if (eventId === seriesId) throw Object.assign(new Error("Server error"), { status: 500 });
      return realDelete(calendarId, eventId);
    };

    await expect(service.update(seriesId, { ...gym, maxCount: "3" })).rejects.toThrow(
      OldSeriesNotRemovedError,
    );
    expect(await service.list()).toHaveLength(2);
  });
});

describe("removeAll", () => {
  it("deletes every series, reporting progress, and keeps the calendar", async () => {
    const { api, service } = setup();
    await service.create(gym);
    const { calendarId } = await service.create({ ...gym, name: "Yoga", frequency: "weekly" });
    const progress = [];

    expect(await service.removeAll({ onProgress: (p) => progress.push(p) })).toEqual({ deleted: 2 });
    expect(progress).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
    expect(await service.list()).toEqual([]);
    expect(api.calendars.has(calendarId)).toBe(true);
  });

  it("does nothing for a new user", async () => {
    const { service } = setup();
    expect(await service.removeAll()).toEqual({ deleted: 0 });
  });
});

describe("occurrenceCount", () => {
  it("counts every dated item, including the start event", async () => {
    const { service } = setup();
    await service.create({ ...gym, startTitle: "{name} started", maxCount: "3" });
    const [series] = await service.list();
    expect(series).toMatchObject({ occurrenceCount: 4, total: 3 });
  });
});

describe("calendars created before the rename", () => {
  it("are still recognized after a reinstall", async () => {
    const calendarList = [
      {
        id: "old",
        summary: "EventBetter",
        description: "Created by the EventBetter app. Deleting this calendar deletes all its subscriptions.",
        accessRole: "owner",
      },
    ];
    const { service } = setup({ calendarList });
    expect(await service.ensureCalendar()).toBe("old");
  });
});


describe("color", () => {
  const GRAPE = "#8e24aa";
  const BLUE = "#4285f4";
  const TONE = "#123abc";
  const calls = (api, name) => api.calls.filter(([n]) => n === name);
  const labelId = (api, hex) =>
    [...api.calendars.keys()].flatMap((id) => api.labelsOf(id)).find((l) => l.backgroundColor === hex)?.id;

  describe("on an account with event labels", () => {
    it("gives a new event the default Grape through its existing label", async () => {
      const { api, service } = setup();
      const result = await service.create(gym);

      const [, , body, query] = calls(api, "insertEvent")[0];
      expect(body.eventLabelId).toBe(labelId(api, GRAPE));
      expect(body.colorId).toBeUndefined();
      expect(query).toEqual({ eventLabelVersion: 1 });
      expect(calls(api, "patchCalendar")).toHaveLength(0);

      const instances = await api.listInstances(result.calendarId, result.seriesId);
      expect(instances.every((i) => i.eventLabelId === labelId(api, GRAPE))).toBe(true);
    });

    it("adds a missing label once, keeps the existing ones and reuses it", async () => {
      const { api, service } = setup();
      await service.create({ ...gym, color: TONE });
      await service.create({ ...gym, name: "Other", color: TONE });

      const labels = api.labelsOf([...api.calendars.keys()][0]);
      expect(labels).toHaveLength(DEFAULT_LABEL_HEXES.length + 1);
      expect(labels.filter((l) => l.backgroundColor === TONE)).toHaveLength(1);
      expect(calls(api, "patchCalendar")).toHaveLength(1);
      expect(labels.at(-1).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("adds the label on a calendar that predates the defaults", async () => {
      const { api, service } = setup({ labelMode: "empty" });
      await service.create({ ...gym, color: BLUE });
      expect(api.labelsOf([...api.calendars.keys()][0]).map((l) => l.backgroundColor)).toEqual([BLUE]);
    });

    it("handles two creations at once without losing a label", async () => {
      const { api, service } = setup({ labelMode: "empty" });
      await service.ensureCalendar();
      await Promise.all([
        service.create({ ...gym, name: "A", color: BLUE }),
        service.create({ ...gym, name: "B", color: TONE }),
      ]);
      const hexes = api.labelsOf([...api.calendars.keys()][0]).map((l) => l.backgroundColor).sort();
      expect(hexes).toEqual([BLUE, TONE].sort());
    });

    it("sends no color at all for an event without one", async () => {
      const { api, service } = setup();
      await service.create({ ...gym, color: "" });
      const [, , body, query] = calls(api, "insertEvent")[0];
      expect(body.eventLabelId).toBeUndefined();
      expect(body.colorId).toBeUndefined();
      expect(query).toBeUndefined();
      expect(calls(api, "patchCalendar")).toHaveLength(0);
    });

    it("lists the color with the event", async () => {
      const { service } = setup();
      await service.create({ ...gym, color: BLUE });
      await service.create({ ...gym, name: "Plain", color: "" });
      const byName = Object.fromEntries((await service.list()).map((s) => [s.name, s.color]));
      expect(byName).toEqual({ "Tuff Gym membership": BLUE, Plain: "" });
    });

    it("falls back to the classic color if Google drops the label after saving", async () => {
      const { api, service } = setup();
      const insert = api.insertEvent;
      api.insertEvent = (calendarId, body, query) => {
        const { eventLabelId, ...withoutLabel } = body;
        return insert(calendarId, withoutLabel, query);
      };
      const result = await service.create(gym);

      const patch = calls(api, "patchEvent").find(([, , id]) => id === result.seriesId);
      expect(patch[3]).toEqual({ colorId: "3" });
      expect(await service.getColorSupport()).toBe(false);
    });
  });

  describe.each([["silent"], ["rejecting"]])("on an account without event labels (%s)", (labelMode) => {
    it("uses the classic color instead and still creates the event", async () => {
      const { api, service } = setup({ labelMode });
      const result = await service.create(gym);

      const [, , body, query] = calls(api, "insertEvent")[0];
      expect(body.colorId).toBe("3");
      expect(body.eventLabelId).toBeUndefined();
      expect(query).toBeUndefined();
      expect(result.count).toBe(12);
    });

    it("maps a color outside the classic 11 to the nearest one", async () => {
      const { api, service } = setup({ labelMode });
      await service.create({ ...gym, color: "#3a4fb0" });
      expect(calls(api, "insertEvent")[0][2].colorId).toBe("9");
    });

    it("stops trying labels once it knows", async () => {
      const { api, service } = setup({ labelMode });
      await service.create(gym);
      await service.create({ ...gym, name: "Other", color: BLUE });
      expect(calls(api, "patchCalendar")).toHaveLength(1);
    });
  });

  describe("getColorSupport", () => {
    it("is true from a non-empty label list, without writing", async () => {
      const { api, service } = setup();
      expect(await service.getColorSupport()).toBe(true);
      expect(calls(api, "patchCalendar")).toHaveLength(0);
    });

    it("tries the default color on an empty list, and that proves support", async () => {
      const { api, service } = setup({ labelMode: "empty" });
      expect(await service.getColorSupport()).toBe(true);
      expect(calls(api, "patchCalendar")).toHaveLength(1);
    });

    it.each([["silent"], ["rejecting"]])("is false when labels are ignored or rejected (%s)", async (labelMode) => {
      const { service } = setup({ labelMode });
      expect(await service.getColorSupport()).toBe(false);
    });

    it("answers once and shares one check between simultaneous callers", async () => {
      const { api, service } = setup({ labelMode: "empty" });
      const answers = await Promise.all([service.getColorSupport(), service.getColorSupport()]);
      expect(answers).toEqual([true, true]);
      await service.getColorSupport();
      expect(calls(api, "patchCalendar")).toHaveLength(1);
    });
  });

  describe("changing only the color", () => {
    async function seeded(color = GRAPE) {
      const ctx = setup();
      const created = await ctx.service.create({ ...gym, color });
      const [series] = await ctx.service.list();
      return { ...ctx, created, series };
    }

    it("patches the series master once instead of recreating it", async () => {
      const { api, service, created, series } = await seeded();
      const before = api.calls.length;
      const result = await service.update(series.id, { ...series.config, color: BLUE }, { previous: series.config });

      expect(result.seriesId).toBe(created.seriesId);
      const after = api.calls.slice(before).filter(([n]) => n !== "getCalendar" && n !== "listCalendarList");
      expect(after.map(([n]) => n)).toEqual(["patchEvent"]);
      const [, , id, body, query] = after[0];
      expect(id).toBe(created.seriesId);
      expect(body.eventLabelId).toBe(labelId(api, BLUE));
      expect(query).toEqual({ eventLabelVersion: 1 });
      expect(JSON.parse(body.extendedProperties.private.ebConfig).color).toBe(BLUE);
      expect(body.extendedProperties.private.ebKey).toBe("Tuff Gym membership|2026-09-30|monthly|1");
    });

    it("shows the new color in the list and on the renamed occurrences", async () => {
      const { api, service, created, series } = await seeded();
      await service.update(series.id, { ...series.config, color: BLUE }, { previous: series.config });

      expect((await service.list())[0].color).toBe(BLUE);
      const instances = await api.listInstances(created.calendarId, created.seriesId);
      expect(instances.every((i) => i.eventLabelId === labelId(api, BLUE))).toBe(true);
    });

    it("does nothing when nothing changed", async () => {
      const { api, service, series } = await seeded();
      const before = api.calls.length;
      await service.update(series.id, { ...series.config }, { previous: series.config });
      expect(api.calls.slice(before).map(([n]) => n).filter((n) => /insert|patch|delete/.test(n))).toEqual([]);
    });

    it("recreates the event when anything else changed too", async () => {
      const { api, service, created, series } = await seeded();
      const result = await service.update(
        series.id,
        { ...series.config, color: BLUE, title: "{name}: {ord} {units} done" },
        { previous: series.config },
      );
      expect(result.seriesId).not.toBe(created.seriesId);
      expect(calls(api, "deleteEvent").map(([, , id]) => id)).toContain(created.seriesId);
    });

    it("recreates the event if the quick patch fails", async () => {
      const { api, service, created, series } = await seeded();
      const patch = api.patchEvent;
      api.patchEvent = async (calendarId, eventId, ...rest) => {
        if (eventId === created.seriesId) throw Object.assign(new Error("boom"), { status: 500 });
        return patch(calendarId, eventId, ...rest);
      };
      const result = await service.update(series.id, { ...series.config, color: BLUE }, { previous: series.config });
      expect(result.seriesId).not.toBe(created.seriesId);
      expect((await service.list()).map((s) => s.color)).toEqual([BLUE]);
    });

    it("recreates when editing without the previous settings (as before)", async () => {
      const { service, created, series } = await seeded();
      const result = await service.update(series.id, { ...series.config, color: BLUE });
      expect(result.seriesId).not.toBe(created.seriesId);
    });

    it("uses the classic color on an account without labels", async () => {
      const ctx = setup({ labelMode: "silent" });
      await ctx.service.create({ ...gym, color: GRAPE });
      const [series] = await ctx.service.list();
      await ctx.service.update(series.id, { ...series.config, color: "#039be5" }, { previous: series.config });
      const patch = calls(ctx.api, "patchEvent").find(([, , id]) => id === series.id);
      expect(patch[3].colorId).toBe("7");
      expect(patch[3].eventLabelId).toBeUndefined();
    });
  });
});
