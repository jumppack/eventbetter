import AsyncStorage from "@react-native-async-storage/async-storage";

import GoogleAuth from "../../modules/google-auth/src";
import { CALENDAR_SCOPES, GOOGLE_WEB_CLIENT_ID, SCOPES } from "../config/google";

const ACCOUNT_KEY = "eventbetter.account";

export class CalendarAccessDeniedError extends Error {
  constructor() {
    super("EventBetter needs Calendar access to create recurring events.");
    this.name = "CalendarAccessDeniedError";
  }
}

export const isCancelled = (e) =>
  e?.code === "ERR_SIGN_IN_CANCELLED" || e?.code === "ERR_AUTHORIZATION_CANCELLED";

export const needsInteractiveAuthorization = (e) => e?.code === "ERR_AUTHORIZATION_REQUIRED";

// Only the profile is kept, never tokens: Play services caches those.
export async function getStoredAccount() {
  const json = await AsyncStorage.getItem(ACCOUNT_KEY);
  return json ? JSON.parse(json) : null;
}

export async function signIn() {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("GOOGLE_WEB_CLIENT_ID is not set in src/config/google.js");
  }
  const account = await GoogleAuth.signIn(GOOGLE_WEB_CLIENT_ID);
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

// Users can untick individual scopes on the consent screen, so check what was
// actually granted. The calendar list scope is optional; without it we just
// can't recover the calendar after a reinstall.
export async function authorizeCalendar(account, { interactive }) {
  const result = await GoogleAuth.authorize(CALENDAR_SCOPES, account.email, interactive);
  const granted = new Set(result.grantedScopes);
  if (!granted.has(SCOPES.appCalendars)) throw new CalendarAccessDeniedError();
  return {
    accessToken: result.accessToken,
    canListCalendars: granted.has(SCOPES.calendarList),
  };
}

// For calendarApi: returns a current token, or a fresh one after a 401.
export function createTokenProvider(account) {
  let last = null;
  return async ({ forceRefresh }) => {
    if (forceRefresh && last) await GoogleAuth.clearToken(last);
    ({ accessToken: last } = await authorizeCalendar(account, { interactive: false }));
    return last;
  };
}

export async function signOut() {
  await GoogleAuth.signOut();
  await AsyncStorage.clear();
}

// Removes EventBetter's access from the Google account, then clears local state.
export async function disconnect(account) {
  try {
    await GoogleAuth.revokeAccess(account.email, CALENDAR_SCOPES);
  } finally {
    await signOut();
  }
}
