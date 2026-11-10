// In-memory stand-in for calendarApi with the same method surface. Recurring
// events are expanded with rrule, mirroring how Google generates instances.
import { RRule } from "rrule";

let nextId = 1;

// Google's 24 default event labels, as the live probe found them on a fresh calendar.
export const DEFAULT_LABEL_HEXES = [
  "#ef6c00", "#7cb342", "#039be5", "#e67c73", "#f6bf26", "#f4511e", "#a79b8e", "#33b679",
  "#7986cb", "#8e24aa", "#e4c441", "#3f51b5", "#c0ca33", "#795548", "#0b8043", "#009688",
  "#ad1457", "#616161", "#f09300", "#b39ddb", "#9e69af", "#d81b60", "#d50000", "#4285f4",
];

// labelMode says how the fake account treats event labels:
//   "defaults"    supported; new calendars start with the 24 default labels
//   "empty"       supported; new calendars start with none (older than the feature)
//   "silent"      unsupported; label fields are quietly ignored
//   "rejecting"   unsupported; writing labelProperties fails with HTTP 400
export function createFakeCalendarApi({ calendarList = [], labelMode = "defaults" } = {}) {
  const calendars = new Map();
  const events = new Map(); // calendarId -> Map(eventId -> event)
  const overrides = new Map(); // instanceId -> patched fields
  const calls = [];

  const notFound = () => Object.assign(new Error("Not Found"), { status: 404 });
  const eventsOf = (calendarId) => {
    if (!calendars.has(calendarId)) throw notFound();
    return events.get(calendarId);
  };

  function expand(master) {
    const dtstart = master.start.date.replaceAll("-", "");
    const rule = RRule.fromString(`DTSTART:${dtstart}T000000Z\n${master.recurrence[0]}`);
    return rule.all().map((d) => {
      const date = d.toISOString().slice(0, 10);
      const id = `${master.id}_${date.replaceAll("-", "")}`;
      return {
        id,
        recurringEventId: master.id,
        summary: master.summary,
        description: master.description,
        start: { date },
        extendedProperties: master.extendedProperties,
        colorId: master.colorId,
        eventLabelId: master.eventLabelId,
        ...overrides.get(id),
      };
    });
  }

  const supportsLabels = labelMode === "defaults" || labelMode === "empty";
  let labelSeq = 1;
  const labelId = () => `label-${labelSeq++}`;
  const labelsOf = (calendarId) => calendars.get(calendarId)?.labelProperties?.eventLabels ?? [];

  const api = {
    calls,
    calendars,
    overrides,
    labelsOf,

    async insertCalendar(body) {
      calls.push(["insertCalendar", body]);
      const calendar = { id: `cal${nextId++}@group.calendar.google.com`, ...body };
      if (labelMode === "defaults") {
        calendar.labelProperties = {
          eventLabels: DEFAULT_LABEL_HEXES.map((backgroundColor) => ({ id: labelId(), backgroundColor })),
        };
      }
      calendars.set(calendar.id, calendar);
      events.set(calendar.id, new Map());
      calendarList.push({ ...calendar, accessRole: "owner" });
      return calendar;
    },

    async getCalendar(calendarId) {
      calls.push(["getCalendar", calendarId]);
      return calendars.get(calendarId) ?? null;
    },

    async patchCalendar(calendarId, body) {
      calls.push(["patchCalendar", calendarId, body]);
      const calendar = calendars.get(calendarId);
      if (!calendar) throw notFound();
      if (body.labelProperties) {
        if (labelMode === "rejecting") throw Object.assign(new Error("Bad Request"), { status: 400 });
        if (supportsLabels) calendar.labelProperties = structuredClone(body.labelProperties);
      }
      return calendar;
    },

    async listCalendarList() {
      calls.push(["listCalendarList"]);
      return calendarList.filter((c) => !c.deleted);
    },

    async deleteCalendar(calendarId) {
      calendars.delete(calendarId);
      const entry = calendarList.find((c) => c.id === calendarId);
      if (entry) entry.deleted = true;
    },

    async listEvents(calendarId, { privateExtendedProperty } = {}) {
      calls.push(["listEvents", calendarId, privateExtendedProperty]);
      const [key, value] = privateExtendedProperty?.split(/=(.*)/s) ?? [];
      const items = [];
      for (const master of eventsOf(calendarId).values()) {
        items.push(master);
        // Google also returns modified instances, which inherit the tags.
        items.push(...expand(master).filter((i) => overrides.has(i.id)));
      }
      return key ? items.filter((e) => e.extendedProperties?.private?.[key] === value) : items;
    },

    async getEvent(calendarId, eventId) {
      calls.push(["getEvent", calendarId, eventId]);
      return eventsOf(calendarId).get(eventId) ?? null;
    },

    // Like Google: eventLabelId needs eventLabelVersion=1 (which also makes
    // colorId ignored), and an account without labels drops it silently.
    async insertEvent(calendarId, body, query) {
      calls.push(["insertEvent", calendarId, body, query]);
      const event = { id: `evt${nextId++}`, ...structuredClone(body) };
      applyColor(event, query);
      eventsOf(calendarId).set(event.id, event);
      return event;
    },

    async listInstances(calendarId, eventId) {
      calls.push(["listInstances", calendarId, eventId]);
      const master = eventsOf(calendarId).get(eventId);
      if (!master) throw notFound();
      return expand(master);
    },

    async patchEvent(calendarId, eventId, body, query) {
      calls.push(["patchEvent", calendarId, eventId, body, query]);
      const master = eventsOf(calendarId).get(eventId);
      if (master) {
        Object.assign(master, structuredClone(body));
        applyColor(master, query);
        return master;
      }
      overrides.set(eventId, { ...overrides.get(eventId), ...body });
      return { id: eventId, ...body };
    },

    async deleteEvent(calendarId, eventId) {
      calls.push(["deleteEvent", calendarId, eventId]);
      // Google answers 410 Gone for an event that's already deleted.
      if (!eventsOf(calendarId).delete(eventId)) throw Object.assign(new Error("Gone"), { status: 410 });
    },
  };
  function applyColor(event, query) {
    const useLabels = query?.eventLabelVersion === 1;
    if (useLabels) delete event.colorId;
    if (!useLabels || !supportsLabels) delete event.eventLabelId;
    if (event.eventLabelId === "") delete event.eventLabelId;
  }

  return api;
}

export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}
