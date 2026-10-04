import { UNITS } from "../config/defaults";
import { toDateString } from "./schedule";

export function describeFrequency({ frequency, interval }) {
  const unit = UNITS[frequency];
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}

// Progress for the list screen. An occurrence dated today counts as done
// ("5th month over" happens on its date). The optional start event (n = 0)
// isn't counted toward "5 of 12", but can still be the next occurrence.
// Dates compare as YYYY-MM-DD strings, so no time-of-day or zone math.
export function summarize(items, today) {
  const todayStr = toDateString(today);
  const numbered = items.filter((o) => o.n > 0);
  const done = numbered.filter((o) => toDateString(o.date) <= todayStr).length;
  const next = items.find((o) => toDateString(o.date) > todayStr) ?? null;
  return {
    done,
    total: numbered.length,
    next: next && { date: next.date, title: next.title },
    completed: next === null,
  };
}

// Upcoming first (soonest at the top), completed last, then by name.
export function compareSubscriptions(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const aNext = a.next ? toDateString(a.next.date) : "";
  const bNext = b.next ? toDateString(b.next.date) : "";
  if (aNext !== bNext) return aNext < bNext ? -1 : 1;
  return a.name.localeCompare(b.name);
}
