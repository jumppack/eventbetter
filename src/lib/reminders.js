import { MAX_REMINDERS, REMINDER_HOUR, REMINDERS_PER_SUBSCRIPTION } from "../config/defaults";
import { toDateString } from "./schedule";
import { buildOccurrences } from "./series";

// 9:00 AM local time the day before the occurrence. Building the Date from
// local parts keeps it at 9:00 across DST changes.
export function reminderTime(occurrenceDate) {
  return new Date(
    occurrenceDate.getFullYear(),
    occurrenceDate.getMonth(),
    occurrenceDate.getDate() - 1,
    REMINDER_HOUR,
  );
}

// Which local notifications should exist right now: the next few upcoming
// occurrences per subscription, soonest first, capped overall. `key` is
// stable across runs so unchanged reminders aren't rescheduled.
export function planReminders(subscriptions, now) {
  const all = [];
  for (const sub of subscriptions) {
    if (!sub.editable || !sub.config) continue;
    const upcoming = buildOccurrences(sub.config)
      .map((item) => ({ item, fireAt: reminderTime(item.date) }))
      .filter(({ fireAt }) => fireAt > now)
      .slice(0, REMINDERS_PER_SUBSCRIPTION);

    for (const { item, fireAt } of upcoming) {
      all.push({
        key: `${sub.id}|${toDateString(item.date)}`,
        fireAt,
        title: sub.name,
        body: `Tomorrow: ${item.title}`,
      });
    }
  }
  return all.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_REMINDERS);
}
