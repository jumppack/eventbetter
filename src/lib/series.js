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
    properties: {
      ebKey: checkedValue("ebKey", keyFor(sub)),
      ebName: checkedValue("ebName", sub.name),
      ebConfig: checkedValue("ebConfig", encodeConfig(sub)),
    },
  };
}

// The Calendar API resource for the recurring master. Occurrences after the
// first are renamed afterwards, one patch each.
export function toSeriesEvent(plan) {
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
  };
}

export function encodeConfig(sub) {
  const config = { v: CONFIG_VERSION };
  for (const field of CONFIG_FIELDS) config[field] = sub[field];
  return JSON.stringify(config);
}

// Version 1 predates numbering options: it always counted up from one
// period after the start date, with no end title.
export function decodeConfig(json) {
  const { v, ...config } = JSON.parse(json);
  if (v === 1) return { ...config, direction: "up", starting: "later", endTitle: "" };
  if (v !== CONFIG_VERSION) {
    throw new Error(`Unsupported event config version: ${v}`);
  }
  return config;
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
