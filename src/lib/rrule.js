import { parseDate } from "./schedule";

const FREQ = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

// `start` is the event's start date (which the clamping is based on),
// not necessarily the series' first occurrence. `count` is resolved from the
// end date and number of events beforehand, so UNTIL is never used.
export function rrule({ start, frequency, interval, count }) {
  const base = parseDate(start);
  const day = base.getDate();
  const parts = [`FREQ=${FREQ[frequency]}`, `INTERVAL=${interval}`];

  // A plain monthly rule starting on the 29th-31st skips shorter months.
  // "The last of these days that exists" clamps to the month's end instead.
  if (frequency === "monthly" && day > 28) {
    const days = [];
    for (let d = 28; d <= day; d++) days.push(d);
    parts.push(`BYMONTHDAY=${days.join(",")}`, "BYSETPOS=-1");
  } else if (frequency === "yearly" && base.getMonth() === 1 && day === 29) {
    parts.push("BYMONTH=2", "BYMONTHDAY=28,29", "BYSETPOS=-1");
  }

  parts.push(`COUNT=${count}`);
  return "RRULE:" + parts.join(";");
}
