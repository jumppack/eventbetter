// OAuth client IDs are public identifiers (they ship inside the app), not
// secrets. The Android client is matched by package name + SHA-1 in Google
// Cloud and needs no ID here; Credential Manager needs the Web client ID.
export const GOOGLE_WEB_CLIENT_ID = "624640662955-9a4i0a135h7j4koaau8k7m84bv19gi5i.apps.googleusercontent.com";

export const SCOPES = {
  // Create the app's own calendar and manage events on it, nothing else.
  appCalendars: "https://www.googleapis.com/auth/calendar.app.created",
  // Find that calendar again after a reinstall or on a new phone.
  calendarList: "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
};

export const CALENDAR_SCOPES = [SCOPES.appCalendars, SCOPES.calendarList];
