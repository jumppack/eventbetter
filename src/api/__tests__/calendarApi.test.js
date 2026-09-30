import { CalendarApiError, createCalendarApi } from "../calendarApi";

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const apiError = (status, reason) => json(status, { error: { message: reason, errors: [{ reason }] } });

function setup(responses) {
  const requests = [];
  const sleeps = [];
  const tokens = [];
  let tokenCount = 0;
  const api = createCalendarApi({
    getAccessToken: async ({ forceRefresh }) => {
      tokens.push(forceRefresh);
      return `token-${++tokenCount}`;
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, ...init });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected request: ${url}`);
      return next;
    },
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { api, requests, sleeps, tokens };
}

describe("calendarApi", () => {
  it("sends the bearer token and JSON body", async () => {
    const { api, requests } = setup([json(200, { id: "cal1" })]);
    await api.insertCalendar({ summary: "EventBetter" });

    expect(requests[0].url).toBe("https://www.googleapis.com/calendar/v3/calendars");
    expect(requests[0].method).toBe("POST");
    expect(requests[0].headers).toEqual({
      Authorization: "Bearer token-1",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(requests[0].body)).toEqual({ summary: "EventBetter" });
  });

  it("reuses the token across requests", async () => {
    const { api, tokens } = setup([json(200, {}), json(200, {})]);
    await api.getCalendar("a");
    await api.getCalendar("b");
    expect(tokens).toEqual([false]);
  });

  it("encodes IDs and the extended property query", async () => {
    const { api, requests } = setup([json(200, { items: [] })]);
    await api.listEvents("abc@group.calendar.google.com", {
      privateExtendedProperty: "ebKey=Gym & Spa|2026-09-30|monthly|1",
    });
    expect(requests[0].url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/abc%40group.calendar.google.com/events" +
        "?maxResults=2500&privateExtendedProperty=ebKey%3DGym%20%26%20Spa%7C2026-09-30%7Cmonthly%7C1",
    );
  });

  it("follows pagination", async () => {
    const { api, requests } = setup([
      json(200, { items: [{ id: 1 }, { id: 2 }], nextPageToken: "p2" }),
      json(200, { items: [{ id: 3 }] }),
    ]);
    expect(await api.listInstances("c", "e")).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(requests[1].url).toContain("pageToken=p2");
  });

  it("returns null for a missing calendar", async () => {
    const { api } = setup([apiError(404, "notFound")]);
    expect(await api.getCalendar("gone")).toBeNull();
  });

  it("returns null for 204 responses", async () => {
    const { api } = setup([{ ok: true, status: 204, json: async () => ({}) }]);
    expect(await api.deleteEvent("c", "e")).toBeNull();
  });

  it("refreshes the token once on 401", async () => {
    const { api, requests, tokens } = setup([apiError(401, "authError"), json(200, { id: "x" })]);
    await api.getCalendar("c");
    expect(tokens).toEqual([false, true]);
    expect(requests[1].headers.Authorization).toBe("Bearer token-2");
  });

  it("gives up after a second 401", async () => {
    const { api } = setup([apiError(401, "authError"), apiError(401, "authError")]);
    await expect(api.getCalendar("c")).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    [403, "rateLimitExceeded"],
    [403, "userRateLimitExceeded"],
    [429, "rateLimitExceeded"],
    [503, "backendError"],
  ])("retries %i %s with exponential backoff", async (status, reason) => {
    const { api, sleeps } = setup([apiError(status, reason), apiError(status, reason), json(200, {})]);
    await api.patchEvent("c", "e", { summary: "x" });
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(2000);
  });

  it("does not retry a 403 that isn't a rate limit", async () => {
    const { api, sleeps } = setup([apiError(403, "forbidden")]);
    const error = await api.patchEvent("c", "e", {}).catch((e) => e);
    expect(error).toBeInstanceOf(CalendarApiError);
    expect(error).toMatchObject({ status: 403, reason: "forbidden" });
    expect(sleeps).toEqual([]);
  });

  it("stops retrying after the limit", async () => {
    const { api, sleeps } = setup(Array.from({ length: 6 }, () => apiError(429, "rateLimitExceeded")));
    await expect(api.patchEvent("c", "e", {})).rejects.toMatchObject({ status: 429 });
    expect(sleeps).toHaveLength(5);
  });

  it("handles non-JSON error bodies", async () => {
    const { api } = setup([{ ok: false, status: 400, json: async () => { throw new SyntaxError(); } }]);
    await expect(api.insertEvent("c", {})).rejects.toMatchObject({ status: 400, reason: undefined });
  });
});
