import { CALENDAR_NAME, DEFAULTS, WRITE_DELAY_MS } from "../config/defaults";
import { classicIdFor, nearestClassic } from "../lib/color";
import { toDateString } from "../lib/schedule";
import {
  buildOccurrences,
  decodeConfig,
  keyFor,
  planSeries,
  propertiesFor,
  sameExceptColor,
  toSeriesEvent,
} from "../lib/series";
import { compareSeries, describeFrequency, summarize } from "../lib/summary";
import { uuid as defaultUuid } from "../lib/uuid";
import { normalize } from "../lib/validate";

const CALENDAR_ID_KEY = "eventbetter.calendarId";
// Lets us tell our calendar apart from a user-made one with the same name.
const CALENDAR_DESCRIPTION =
  "Created by the EventBetter app. Deleting this calendar deletes all its recurring events.";
// Calendars created before the rename carry the old wording; still ours.
const KNOWN_DESCRIPTIONS = new Set([
  CALENDAR_DESCRIPTION,
  "Created by the EventBetter app. Deleting this calendar deletes all its subscriptions.",
]);

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

// Thrown inside the service when the account doesn't take event labels (colors).
class LabelsUnsupportedError extends Error {}

// How Google may answer a labelProperties write on an account without the feature.
const UNSUPPORTED_STATUSES = new Set([400, 403, 501]);

const labelsOf = (calendar) => calendar?.labelProperties?.eventLabels ?? [];
const findLabel = (labels, hex) => labels.find((l) => l.backgroundColor?.toLowerCase() === hex);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google answers 410 for an event that's already deleted.
const isGone = (e) => e?.status === 404 || e?.status === 410;

// `api` is a calendarApi instance, `storage` an AsyncStorage-compatible object.
// `canListCalendars` is true when a calendarList scope was granted, which lets
// us find our calendar again after a reinstall.
export function createSeriesService({
  api,
  storage,
  canListCalendars = false,
  sleep = defaultSleep,
  now = () => new Date(),
  uuid = defaultUuid,
}) {
  async function findOwnCalendar() {
    const storedId = await storage.getItem(CALENDAR_ID_KEY);
    if (storedId && (await api.getCalendar(storedId))) return storedId;

    if (!canListCalendars) return null;
    const match = (await api.listCalendarList()).find(
      (c) =>
        c.summary === CALENDAR_NAME &&
        KNOWN_DESCRIPTIONS.has(c.description) &&
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

  // Whether event labels work on this account: true, false, or null if not yet
  // known. Learned by behavior, never by version, and kept for this session.
  let labelSupport = null;
  let supportCheck = null;
  let labelQueue = Promise.resolve();

  // Returns the id of the calendar's label with this color, adding one if
  // needed. The label list is replaced as a whole on write, so it's always read
  // first, and writes run one at a time.
  function ensureLabel(calendarId, hex) {
    const run = labelQueue.then(() => ensureLabelNow(calendarId, hex));
    labelQueue = run.catch(() => {});
    return run;
  }

  async function ensureLabelNow(calendarId, hex) {
    const labels = labelsOf(await api.getCalendar(calendarId));
    const existing = findLabel(labels, hex);
    if (existing) {
      labelSupport = true;
      return existing.id;
    }

    try {
      await api.patchCalendar(calendarId, {
        labelProperties: { eventLabels: [...labels, { id: uuid(), backgroundColor: hex }] },
      });
    } catch (e) {
      if (!UNSUPPORTED_STATUSES.has(e?.status)) throw e;
      labelSupport = false;
      throw new LabelsUnsupportedError();
    }

    // An account without the feature may accept the call and ignore it.
    const stored = findLabel(labelsOf(await api.getCalendar(calendarId)), hex);
    labelSupport = Boolean(stored);
    if (!stored) throw new LabelsUnsupportedError();
    return stored.id;
  }

  // Whether the account supports event labels. A non-empty label list proves it.
  // An empty one is ambiguous (no feature, or a calendar older than the 24
  // defaults), so the default color is added and read back to find out.
  function getColorSupport() {
    if (labelSupport !== null) return Promise.resolve(labelSupport);
    supportCheck ??= (async () => {
      const calendarId = await ensureCalendar();
      if (labelsOf(await api.getCalendar(calendarId)).length) return (labelSupport = true);
      try {
        await ensureLabel(calendarId, DEFAULTS.color);
      } catch (e) {
        if (!(e instanceof LabelsUnsupportedError)) throw e;
      }
      return labelSupport === true;
    })().finally(() => {
      supportCheck = null;
    });
    return supportCheck;
  }

  // The fields that give an event its color: a label where supported, the
  // nearest classic color otherwise. `label` is set when a label was used, so
  // callers can check Google kept it.
  async function resolveColor(calendarId, color) {
    if (!color) return { body: {}, query: undefined, label: null };
    if (labelSupport !== false) {
      try {
        const label = await ensureLabel(calendarId, color);
        return { body: { eventLabelId: label }, query: { eventLabelVersion: 1 }, label };
      } catch (e) {
        if (!(e instanceof LabelsUnsupportedError)) throw e;
      }
    }
    return { body: { colorId: classicColorId(color) }, query: undefined, label: null };
  }

  const classicColorId = (color) => classicIdFor(color) ?? nearestClassic(color).id;

  // An account that dropped our label silently: fall back to the classic color.
  async function settleColor(calendarId, event, color, hex) {
    if (!color.label || event.eventLabelId === color.label) return;
    labelSupport = false;
    await api.patchEvent(calendarId, event.id, { colorId: classicColorId(hex) });
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

    const color = await resolveColor(calendarId, sub.color);

    onProgress({ phase: "creating", done: 0, total });
    const series = await api.insertEvent(calendarId, toSeriesEvent(plan, color.body), color.query);

    try {
      await settleColor(calendarId, series, color, sub.color);
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
  // that succeeds, so a failed edit never loses the recurring event.
  //
  // The exception is a change of color alone, which is one patch on the series
  // master: its occurrences, renamed ones too, follow it. Pass the event's
  // current settings as `previous` to allow that; if the patch fails for any
  // reason the event is simply recreated.
  async function update(seriesId, input, options = {}) {
    const quick = options.previous && (await recolor(seriesId, input, options.previous).catch(() => null));
    if (quick) return quick;

    const result = await create(input, { ...options, replacing: seriesId });
    try {
      await api.deleteEvent(result.calendarId, seriesId);
    } catch (e) {
      if (!isGone(e)) throw new OldSeriesNotRemovedError(result.name);
    }
    return result;
  }

  async function recolor(seriesId, input, previous) {
    const sub = normalize(input);
    if (!sub.color || !sameExceptColor(previous, sub)) return null;
    const calendarId = await findOwnCalendar();
    if (!calendarId) return null;

    if (sub.color !== previous.color) {
      const color = await resolveColor(calendarId, sub.color);
      const series = await api.patchEvent(
        calendarId,
        seriesId,
        { ...color.body, extendedProperties: { private: propertiesFor(sub) } },
        color.query,
      );
      await settleColor(calendarId, { ...series, id: seriesId }, color, sub.color);
    }
    return { calendarId, seriesId, name: sub.name };
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

  // Doesn't create the calendar: a new user simply has no recurring events yet.
  async function list() {
    const calendarId = await findOwnCalendar();
    if (!calendarId) return [];
    const events = await api.listEvents(calendarId, {
      fields: "nextPageToken,items(id,recurringEventId,summary,extendedProperties)",
    });
    const today = now();
    return events
      .filter((e) => !e.recurringEventId && e.extendedProperties?.private?.ebKey)
      .map((e) => toSeries(e, today))
      .sort(compareSeries);
  }

  // Deletes every recurring event EventBetter created, one series at a time.
  // The calendar itself is kept: anything the user added to it by hand stays.
  async function removeAll({ onProgress = () => {} } = {}) {
    const all = await list();
    onProgress({ done: 0, total: all.length });
    for (let i = 0; i < all.length; i++) {
      await remove(all[i].id);
      onProgress({ done: i + 1, total: all.length });
      if (i < all.length - 1) await sleep(WRITE_DELAY_MS);
    }
    return { deleted: all.length };
  }

  async function get(seriesId) {
    const calendarId = await findOwnCalendar();
    if (!calendarId) return null;
    const event = await api.getEvent(calendarId, seriesId);
    return event && toSeries(event, now());
  }

  return { ensureCalendar, findSeriesByKey, getColorSupport, create, update, remove, removeAll, list, get };
}

// A series we can't read the config of (hand-edited, or from a future
// version) is still listed and deletable, just not editable.
function toSeries(event, today) {
  const props = event.extendedProperties?.private ?? {};
  const base = { id: event.id, name: props.ebName || event.summary || "Untitled" };
  let config;
  try {
    config = normalize(decodeConfig(props.ebConfig));
  } catch {
    return { ...base, config: null, editable: false, completed: false, next: null, occurrenceCount: null };
  }
  const items = buildOccurrences(config);
  return {
    ...base,
    config,
    color: config.color,
    editable: true,
    frequencyLabel: describeFrequency(config),
    // Every dated item in Calendar, including the optional start event.
    occurrenceCount: items.length,
    ...summarize(items, today),
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
