// In-memory stand-in for calendarApi with the same method surface. Recurring
// events are expanded with rrule, mirroring how Google generates instances.
import { RRule } from "rrule";

let nextId = 1;

export function createFakeCalendarApi({ calendarList = [] } = {}) {
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
        ...overrides.get(id),
      };
    });
  }

  const api = {
    calls,
    calendars,
    overrides,

    async insertCalendar(body) {
      calls.push(["insertCalendar", body]);
      const calendar = { id: `cal${nextId++}@group.calendar.google.com`, ...body };
      calendars.set(calendar.id, calendar);
      events.set(calendar.id, new Map());
      calendarList.push({ ...calendar, accessRole: "owner" });
      return calendar;
    },

    async getCalendar(calendarId) {
      calls.push(["getCalendar", calendarId]);
      return calendars.get(calendarId) ?? null;
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

    async insertEvent(calendarId, body) {
      calls.push(["insertEvent", calendarId, body]);
      const event = { id: `evt${nextId++}`, ...structuredClone(body) };
      eventsOf(calendarId).set(event.id, event);
      return event;
    },

    async listInstances(calendarId, eventId) {
      calls.push(["listInstances", calendarId, eventId]);
      const master = eventsOf(calendarId).get(eventId);
      if (!master) throw notFound();
      return expand(master);
    },

    async patchEvent(calendarId, eventId, body) {
      calls.push(["patchEvent", calendarId, eventId, body]);
      overrides.set(eventId, { ...overrides.get(eventId), ...body });
      return { id: eventId, ...body };
    },

    async deleteEvent(calendarId, eventId) {
      calls.push(["deleteEvent", calendarId, eventId]);
      // Google answers 410 Gone for an event that's already deleted.
      if (!eventsOf(calendarId).delete(eventId)) throw Object.assign(new Error("Gone"), { status: 410 });
    },
  };
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
