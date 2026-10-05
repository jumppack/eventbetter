export const CALENDAR_NAME = "EventBetter";

// Display order: shortest to longest period. The default (DEFAULTS.frequency) is monthly.
export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

export const UNITS = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

export const DEFAULTS = {
  frequency: "monthly",
  interval: 1,
  maxCount: 12,
  title: "{name}: {ord} {unit} over",
  startTitle: "",
  description: "",
};

// Every occurrence after the first is patched individually, so this bounds
// both creation time (~250 ms per patch) and Calendar API quota use.
export const MAX_COUNT = 500;

export const WRITE_DELAY_MS = 250;

// All-day events count reminder minutes back from midnight at the start of
// the event day: 900 min = 15 h before = 9:00 AM the day before.
export const REMINDER_MINUTES = 900;

// Calendar API: longer extended property values are silently truncated.
export const MAX_PROPERTY_VALUE_LENGTH = 1024;

// Local notifications: 9:00 AM local time the day before each occurrence,
// for the next few occurrences only (Android caps pending alarms per app).
export const REMINDER_HOUR = 9;
export const REMINDERS_PER_SERIES = 2;
export const MAX_REMINDERS = 50;
