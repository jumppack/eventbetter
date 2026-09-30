// Verifies against the real Calendar API that Google generates exactly the
// occurrence dates we title, including the BYSETPOS month-end clamping.
// Skipped unless GOOGLE_ACCESS_TOKEN is set; see `npm run test:live`.
// Works in a throwaway calendar that is deleted afterwards.
import { toDateString } from "../../lib/schedule";
import { planSeries, toSeriesEvent } from "../../lib/series";
import { normalize } from "../../lib/validate";
import { createCalendarApi } from "../calendarApi";

const token = process.env.GOOGLE_ACCESS_TOKEN;
// All-day dates don't depend on the device zone, so one project is enough.
const run = token && globalThis.__TEST_TZ__ === "Asia/Kolkata" ? describe : describe.skip;

const CASES = [
  { name: "Monthly from the 31st", start: "2027-01-31", frequency: "monthly", maxCount: "24" },
  { name: "Monthly from the 30th", start: "2027-01-30", frequency: "monthly", maxCount: "14" },
  { name: "Monthly from the 29th, leap year", start: "2028-01-29", frequency: "monthly", maxCount: "14" },
  { name: "Quarterly from the 31st", start: "2027-01-31", frequency: "monthly", interval: "3", maxCount: "8" },
  { name: "Yearly from Feb 29", start: "2028-02-29", frequency: "yearly", maxCount: "5" },
  { name: "Monthly from the 31st with start event", start: "2027-01-31", frequency: "monthly", maxCount: "6", startTitle: "{name} started" },
];

run("Google Calendar generates the planned dates", () => {
  const api = createCalendarApi({ getAccessToken: async () => token });
  let calendarId;

  beforeAll(async () => {
    const calendar = await api.insertCalendar({
      summary: `EventBetter live test ${new Date().toISOString()}`,
    });
    calendarId = calendar.id;
  });

  afterAll(async () => {
    if (calendarId) await api.deleteCalendar(calendarId);
  });

  it.each(CASES)("$name", async (input) => {
    const plan = planSeries(normalize(input));
    const series = await api.insertEvent(calendarId, toSeriesEvent(plan));
    const instances = await api.listInstances(calendarId, series.id);

    expect({ rrule: plan.rrule, dates: instances.map((i) => i.start.date) }).toEqual({
      rrule: plan.rrule,
      dates: plan.items.map((o) => toDateString(o.date)),
    });
  }, 60_000);
});
