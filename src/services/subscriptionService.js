import { CALENDAR_NAME, WRITE_DELAY_MS } from "../config/defaults";
import { toDateString } from "../lib/schedule";
import { buildOccurrences, decodeConfig, keyFor, planSeries, toSeriesEvent } from "../lib/series";
import { compareSubscriptions, describeFrequency, summarize } from "../lib/summary";
import { normalize } from "../lib/validate";

const CALENDAR_ID_KEY = "eventbetter.calendarId";
// Lets us tell our calendar apart from a user-made one with the same name.
const CALENDAR_DESCRIPTION =
  "Created by the EventBetter app. Deleting this calendar deletes all its subscriptions.";

export class SeriesExistsError extends Error {
  constructor(name) {
    super(`"${name}" already exists with this start date and frequency.`);
    this.name = "SeriesExistsError";
  }
}

export class SeriesMismatchError extends Error {
  constructor(expected, actual) {
    super(
      `Google Calendar generated ${actual} occurrences with different dates than the ${expected} planned. Nothing was saved.`,
    );
    this.name = "SeriesMismatchError";
  }
}

export class OldSeriesNotRemovedError extends Error {
  constructor(name) {
    super(
      `"${name}" was saved, but the previous version couldn't be removed. Delete the older copy from the list.`,
    );
    this.name = "OldSeriesNotRemovedError";
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google answers 410 for an event that's already deleted.
const isGone = (e) => e?.status === 404 || e?.status === 410;

// `api` is a calendarApi instance, `storage` an AsyncStorage-compatible object.
// `canListCalendars` is true when a calendarList scope was granted, which lets
// us find our calendar again after a reinstall.
export function createSubscriptionService({
  api,
  storage,
  canListCalendars = false,
  sleep = defaultSleep,
  now = () => new Date(),
}) {
  async function findOwnCalendar() {
    const storedId = await storage.getItem(CALENDAR_ID_KEY);
    if (storedId && (await api.getCalendar(storedId))) return storedId;

    if (!canListCalendars) return null;
    const match = (await api.listCalendarList()).find(
      (c) =>
        c.summary === CALENDAR_NAME &&
        c.description === CALENDAR_DESCRIPTION &&
        c.accessRole === "owner",
    );
    if (!match) return null;

    await storage.setItem(CALENDAR_ID_KEY, match.id);
    return match.id;
  }

  async function ensureCalendar() {
    const existing = await findOwnCalendar();
    if (existing) return existing;

    const created = await api.insertCalendar({
      summary: CALENDAR_NAME,
      description: CALENDAR_DESCRIPTION,
    });
    await storage.setItem(CALENDAR_ID_KEY, created.id);
    return created.id;
  }

  async function findSeriesByKey(calendarId, key) {
    const items = await api.listEvents(calendarId, {
      privateExtendedProperty: `ebKey=${key}`,
    });
    // Renamed occurrences inherit the tags, so keep only the series itself.
    return items.find((e) => !e.recurringEventId) ?? null;
  }

  // `onProgress({ phase, done, total })` drives the progress UI. Phases:
  // "preparing", "creating", "renaming", "done".
  // `replacing` is the series being edited; it doesn't count as a duplicate.
  async function create(input, { onProgress = () => {}, replacing } = {}) {
    const sub = normalize(input);
    const plan = planSeries(sub);
    const total = plan.items.length;
    onProgress({ phase: "preparing", done: 0, total });

    const calendarId = await ensureCalendar();
    const existing = await findSeriesByKey(calendarId, keyFor(sub));
    if (existing && existing.id !== replacing) throw new SeriesExistsError(sub.name);

    onProgress({ phase: "creating", done: 0, total });
    const series = await api.insertEvent(calendarId, toSeriesEvent(plan));

    try {
      const instances = await api.listInstances(calendarId, series.id);
      const byDate = matchInstances(plan.items, instances);
      if (!byDate) throw new SeriesMismatchError(total, instances.length);

      // The first occurrence already carries the series title.
      onProgress({ phase: "renaming", done: 1, total });
      for (let i = 1; i < total; i++) {
        const item = plan.items[i];
        await api.patchEvent(calendarId, byDate.get(toDateString(item.date)).id, {
          summary: item.title,
          description: item.description,
        });
        onProgress({ phase: "renaming", done: i + 1, total });
        if (i < total - 1) await sleep(WRITE_DELAY_MS);
      }
    } catch (e) {
      // Don't leave a half-renamed series behind; the user can simply retry.
      await api.deleteEvent(calendarId, series.id).catch(() => {});
      throw e;
    }

    onProgress({ phase: "done", done: total, total });
    return { calendarId, seriesId: series.id, name: sub.name, count: total };
  }

  // Edit: occurrence titles are all custom, so there's no safe in-place
  // update. Create the new series first and remove the old one only after
  // that succeeds, so a failed edit never loses the subscription.
  async function update(seriesId, input, options = {}) {
    const result = await create(input, { ...options, replacing: seriesId });
    try {
      await api.deleteEvent(result.calendarId, seriesId);
    } catch (e) {
      if (!isGone(e)) throw new OldSeriesNotRemovedError(result.name);
    }
    return result;
  }

  // Deleting the master removes every occurrence.
  async function remove(seriesId) {
    const calendarId = await findOwnCalendar();
    if (!calendarId) return;
    try {
      await api.deleteEvent(calendarId, seriesId);
    } catch (e) {
      if (!isGone(e)) throw e;
    }
  }

  // Doesn't create the calendar: a new user simply has no subscriptions yet.
  async function list() {
    const calendarId = await findOwnCalendar();
    if (!calendarId) return [];
    const events = await api.listEvents(calendarId, {
      fields: "nextPageToken,items(id,recurringEventId,summary,extendedProperties)",
    });
    const today = now();
    return events
      .filter((e) => !e.recurringEventId && e.extendedProperties?.private?.ebKey)
      .map((e) => toSubscription(e, today))
      .sort(compareSubscriptions);
  }

  async function get(seriesId) {
    const calendarId = await findOwnCalendar();
    if (!calendarId) return null;
    const event = await api.getEvent(calendarId, seriesId);
    return event && toSubscription(event, now());
  }

  return { ensureCalendar, findSeriesByKey, create, update, remove, list, get };
}

// A series we can't read the config of (hand-edited, or from a future
// version) is still listed and deletable, just not editable.
function toSubscription(event, today) {
  const props = event.extendedProperties?.private ?? {};
  const base = { id: event.id, name: props.ebName || event.summary || "Untitled" };
  let config;
  try {
    config = normalize(decodeConfig(props.ebConfig));
  } catch {
    return { ...base, config: null, editable: false, completed: false, next: null };
  }
  return {
    ...base,
    config,
    editable: true,
    frequencyLabel: describeFrequency(config),
    ...summarize(buildOccurrences(config), today),
  };
}

// Pairs each planned item with Google's instance for the same date, or returns
// null if the two sets of dates differ at all.
function matchInstances(items, instances) {
  if (items.length !== instances.length) return null;
  const byDate = new Map(instances.map((inst) => [inst.start?.date, inst]));
  const allMatch = items.every((item) => byDate.has(toDateString(item.date)));
  return allMatch && byDate.size === items.length ? byDate : null;
}
