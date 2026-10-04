// The only module that talks to the Calendar REST API (v3).

const BASE_URL = "https://www.googleapis.com/calendar/v3";
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
const MAX_RETRIES = 5;

export class CalendarApiError extends Error {
  constructor(status, reason, message) {
    super(message || `Calendar API request failed (${status})`);
    this.name = "CalendarApiError";
    this.status = status;
    this.reason = reason;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `getAccessToken({ forceRefresh })` comes from the auth layer. Tokens are
// never stored here; on a 401 we ask for a fresh one once and retry.
export function createCalendarApi({ getAccessToken, fetchImpl = fetch, sleep = defaultSleep }) {
  let token = null;

  async function request(method, path, { query, body } = {}) {
    const url = BASE_URL + path + toQueryString(query);
    let refreshed = false;

    for (let attempt = 0; ; attempt++) {
      token ??= await getAccessToken({ forceRefresh: false });
      const res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body && { "Content-Type": "application/json" }),
        },
        body: body && JSON.stringify(body),
      });

      if (res.ok) return res.status === 204 ? null : res.json();

      const error = await toError(res);
      if (error.status === 401 && !refreshed) {
        refreshed = true;
        token = await getAccessToken({ forceRefresh: true });
        continue;
      }
      if (isRetryable(error) && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw error;
    }
  }

  async function paginate(path, query) {
    const items = [];
    let pageToken;
    do {
      const res = await request("GET", path, { query: { ...query, pageToken } });
      items.push(...(res.items || []));
      pageToken = res.nextPageToken;
    } while (pageToken);
    return items;
  }

  const cal = (calendarId) => `/calendars/${encodeURIComponent(calendarId)}`;
  const event = (calendarId, eventId) => `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`;

  return {
    insertCalendar: (calendar) => request("POST", "/calendars", { body: calendar }),

    async getCalendar(calendarId) {
      try {
        return await request("GET", cal(calendarId));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    listCalendarList: () => paginate("/users/me/calendarList", { maxResults: 250 }),

    deleteCalendar: (calendarId) => request("DELETE", cal(calendarId)),

    // Recurring masters and their modified instances are both returned; the
    // instances inherit extended properties, so callers filter on recurringEventId.
    listEvents: (calendarId, query) =>
      paginate(`${cal(calendarId)}/events`, { maxResults: 2500, ...query }),

    async getEvent(calendarId, eventId) {
      try {
        return await request("GET", event(calendarId, eventId));
      } catch (e) {
        if (e.status === 404 || e.status === 410) return null;
        throw e;
      }
    },

    insertEvent: (calendarId, body) => request("POST", `${cal(calendarId)}/events`, { body }),

    listInstances: (calendarId, eventId) =>
      paginate(`${event(calendarId, eventId)}/instances`, { maxResults: 2500 }),

    patchEvent: (calendarId, eventId, body) =>
      request("PATCH", event(calendarId, eventId), { body }),

    deleteEvent: (calendarId, eventId) => request("DELETE", event(calendarId, eventId)),
  };
}

function toQueryString(query) {
  if (!query) return "";
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return params.length ? `?${params.join("&")}` : "";
}

async function toError(res) {
  let reason;
  let message;
  try {
    const { error } = await res.json();
    reason = error?.errors?.[0]?.reason ?? error?.status;
    message = error?.message;
  } catch {
    // Non-JSON error body; the status is all we have.
  }
  return new CalendarApiError(res.status, reason, message);
}

// 403 is only retryable for rate limits; otherwise it's a real permission error.
function isRetryable({ status, reason }) {
  if (status === 429 || status >= 500) return true;
  return status === 403 && RATE_LIMIT_REASONS.has(reason);
}

function backoffMs(attempt) {
  return 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
}
