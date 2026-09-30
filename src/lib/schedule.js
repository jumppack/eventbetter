// Dates are local calendar dates. `new Date("YYYY-MM-DD")` parses as UTC and
// can land on the previous day, so always go through parseDate.

export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateString(parseDate(str)) === str;
}

export function toDateString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, k) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + k);
}

// Monthly and yearly steps are taken from the original date, not the previous
// occurrence, so Jan 31 -> Feb 28 -> Mar 31 rather than drifting to the 28th.
export function addUnits(base, frequency, k) {
  if (frequency === "daily") return addDays(base, k);
  if (frequency === "weekly") return addDays(base, 7 * k);

  const months = frequency === "monthly" ? k : 12 * k;
  const year = base.getFullYear();
  const month = base.getMonth() + months;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(base.getDate(), lastDay));
}

export function occurrences({ start, frequency, interval, end, maxCount }) {
  const startDate = parseDate(start);
  const endDate = end ? parseDate(end) : null;
  const list = [];

  for (let n = 1; n <= maxCount; n++) {
    const date = addUnits(startDate, frequency, n * interval);
    if (endDate && date > endDate) break;
    list.push({ n, date });
  }
  return list;
}
