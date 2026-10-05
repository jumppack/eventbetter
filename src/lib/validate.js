import { DEFAULTS, MAX_COUNT, UNITS } from "../config/defaults";
import { isValidDateString, parseDate } from "./schedule";

const isBlank = (v) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const toInt = (v) => (typeof v === "number" ? v : Number(String(v).trim()));

// Accepts raw form values (strings) and returns the normalized event settings plus
// per-field errors. Empty fields fall back to defaults instead of overriding them.
export function validate(input) {
  const pick = (key) => (isBlank(input[key]) ? DEFAULTS[key] : input[key]);

  const sub = {
    name: isBlank(input.name) ? "" : String(input.name).trim(),
    start: isBlank(input.start) ? "" : String(input.start).trim(),
    frequency: pick("frequency"),
    interval: toInt(pick("interval")),
    end: isBlank(input.end) ? "" : String(input.end).trim(),
    maxCount: toInt(pick("maxCount")),
    title: pick("title"),
    startTitle: isBlank(input.startTitle) ? "" : input.startTitle,
    description: pick("description"),
  };

  const errors = {};
  if (!sub.name) errors.name = "Title is required";

  if (!sub.start) errors.start = "Start date is required";
  else if (!isValidDateString(sub.start)) errors.start = "Start date is invalid";

  if (!Object.hasOwn(UNITS, sub.frequency)) {
    errors.frequency = `Unknown frequency: ${sub.frequency}`;
  }

  if (!Number.isInteger(sub.interval) || sub.interval < 1) {
    errors.interval = "Repeat every must be a whole number of at least 1";
  }

  if (!Number.isInteger(sub.maxCount) || sub.maxCount < 1) {
    errors.maxCount = "Number of events must be a whole number of at least 1";
  } else if (sub.maxCount > MAX_COUNT) {
    errors.maxCount = `Number of events can be at most ${MAX_COUNT}`;
  }

  if (sub.end) {
    if (!isValidDateString(sub.end)) errors.end = "End date is invalid";
    else if (!errors.start && parseDate(sub.end) < parseDate(sub.start)) {
      errors.end = "End date is before start date";
    }
  }

  return { sub, errors, valid: Object.keys(errors).length === 0 };
}

export class ValidationError extends Error {
  constructor(errors) {
    super(Object.values(errors)[0]);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export function normalize(input) {
  const { sub, errors, valid } = validate(input);
  if (!valid) throw new ValidationError(errors);
  return sub;
}
