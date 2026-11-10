import { MAX_PROPERTY_VALUE_LENGTH, REMINDER_MINUTES, UNITS } from "../config/defaults";
import { rrule } from "./rrule";
import { addDays, gridDate, occurrences, toDateString } from "./schedule";
import { fill, vars } from "./template";

const CONFIG_VERSION = 2;
const CONFIG_FIELDS = [
  "name",
  "start",
  "frequency",
  "interval",
  "end",
  "maxCount",
  "direction",
  "starting",
  "color",
  "title",
  "startTitle",
  "endTitle",
  "description",
];

export function keyFor(sub) {
  return [sub.name, sub.start, sub.frequency, sub.interval].join("|");
}

function textFor(sub, n, template) {
  const v = vars(sub.name, n, sub.interval, UNITS[sub.frequency]);
  return { title: fill(template, v), description: fill(sub.description, v) };
}

// Every dated item the series will have, in date order. Numbered occurrences
// show `number` (counted up or down). The start and end titles belong to the
// start date (grid step 0) and the end date (step N): each renames the
// numbered occurrence already on that date, or adds an extra item there. In
// titles they fill {count} with 0 and N respectively.
export function buildOccurrences(sub) {
  const numbered = occurrences(sub);
  const total = numbered.length;
  const list = numbered.map(({ n, step, date }) => {
    const number = sub.direction === "down" ? total - n + 1 : n;
    return { n, step, date, number, numbered: true, ...textFor(sub, number, sub.title) };
  });

  const place = (step, n, number, template) => {
    const text = textFor(sub, number, template);
    const existing = list.find((o) => o.step === step);
    if (existing) Object.assign(existing, text);
    else list.push({ n, step, date: gridDate(sub, step), number, numbered: false, ...text });
  };

  if (sub.startTitle) place(0, 0, 0, sub.startTitle);
  if (sub.endTitle && total > 0) place(total, total + 1, total, sub.endTitle);
  return list.sort((a, b) => a.step - b.step);
}

// Everything needed to write the series, for an already normalized `sub`.
export function planSeries(sub) {
  const items = buildOccurrences(sub);
  if (!items.length) {
    throw new Error("No events fall between the start and end dates");
  }

  return {
    key: keyFor(sub),
    items,
    firstDate: items[0].date,
    rrule: rrule({ ...sub, count: items.length }),
    properties: propertiesFor(sub),
  };
}

// The private extended properties every series carries (see planSeries).
export function propertiesFor(sub) {
  return {
    ebKey: checkedValue("ebKey", keyFor(sub)),
    ebName: checkedValue("ebName", sub.name),
    ebConfig: checkedValue("ebConfig", encodeConfig(sub)),
  };
}

// True when two normalized settings differ at most in color, so a color change
// can update the series in place instead of recreating it.
export function sameExceptColor(a, b) {
  return CONFIG_FIELDS.every((field) => field === "color" || a[field] === b[field]);
}

// The Calendar API resource for the recurring master. Occurrences after the
// first are renamed afterwards, one patch each. `color` is the event's color
// fields, `{ eventLabelId }` or `{ colorId }`, resolved by the service.
export function toSeriesEvent(plan, color = {}) {
  const [first] = plan.items;
  return {
    summary: first.title,
    description: first.description,
    start: { date: toDateString(plan.firstDate) },
    end: { date: toDateString(addDays(plan.firstDate, 1)) },
    recurrence: [plan.rrule],
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: REMINDER_MINUTES }],
    },
    extendedProperties: { private: plan.properties },
    ...color,
  };
}

export function encodeConfig(sub) {
  const config = { v: CONFIG_VERSION };
  for (const field of CONFIG_FIELDS) config[field] = sub[field];
  return JSON.stringify(config);
}

// Version 1 predates numbering options: it always counted up from one
// period after the start date, with no end title. Settings without a color
// (anything saved before colors) get "", meaning Calendar's own color.
export function decodeConfig(json) {
  const { v, ...config } = JSON.parse(json);
  if (v === 1) return { ...config, direction: "up", starting: "later", endTitle: "", color: "" };
  if (v !== CONFIG_VERSION) {
    throw new Error(`Unsupported event config version: ${v}`);
  }
  return { ...config, color: config.color ?? "" };
}

export class PropertyTooLargeError extends Error {
  constructor(key, length) {
    super(
      `This event's details are too long to save (${length} of ${MAX_PROPERTY_VALUE_LENGTH} characters). Shorten the title or templates.`,
    );
    this.name = "PropertyTooLargeError";
    this.key = key;
  }
}

// The limit is documented in characters; UTF-8 bytes are never fewer than
// characters, so measuring bytes is the safe side.
function checkedValue(key, value) {
  const length = utf8Length(value);
  if (length > MAX_PROPERTY_VALUE_LENGTH) throw new PropertyTooLargeError(key, length);
  return value;
}

function utf8Length(str) {
  let bytes = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}
