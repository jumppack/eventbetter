import AsyncStorage from "@react-native-async-storage/async-storage";

import GoogleAuth from "../../../modules/google-auth/src";
import { CALENDAR_SCOPES, SCOPES } from "../../config/google";
import {
  authorizeCalendar,
  CalendarAccessDeniedError,
  createTokenProvider,
  disconnect,
  getStoredAccount,
  isCancelled,
  needsInteractiveAuthorization,
  signIn,
  signOut,
} from "../auth";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../../modules/google-auth/src", () => ({
  signIn: jest.fn(),
  authorize: jest.fn(),
  clearToken: jest.fn(),
  revokeAccess: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../../config/google", () => ({
  ...jest.requireActual("../../config/google"),
  GOOGLE_WEB_CLIENT_ID: "web-client-id.apps.googleusercontent.com",
}));

const account = { email: "user@example.com", name: "User", photoUrl: null };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("signIn", () => {
  it("signs in with the Web client ID and stores only the profile", async () => {
    GoogleAuth.signIn.mockResolvedValue(account);
    expect(await signIn()).toEqual(account);
    expect(GoogleAuth.signIn).toHaveBeenCalledWith("web-client-id.apps.googleusercontent.com");
    expect(await getStoredAccount()).toEqual(account);
  });

  it("stores nothing when sign-in fails", async () => {
    GoogleAuth.signIn.mockRejectedValue(Object.assign(new Error("x"), { code: "ERR_SIGN_IN_CANCELLED" }));
    await expect(signIn()).rejects.toThrow();
    expect(await getStoredAccount()).toBeNull();
  });
});

describe("authorizeCalendar", () => {
  it("requests both Calendar scopes for the signed-in account", async () => {
    GoogleAuth.authorize.mockResolvedValue({ accessToken: "t", grantedScopes: CALENDAR_SCOPES });
    expect(await authorizeCalendar(account, { interactive: true })).toEqual({
      accessToken: "t",
      canListCalendars: true,
    });
    expect(GoogleAuth.authorize).toHaveBeenCalledWith(CALENDAR_SCOPES, "user@example.com", true);
  });

  it("works without the calendar list scope if the user unticked it", async () => {
    GoogleAuth.authorize.mockResolvedValue({ accessToken: "t", grantedScopes: [SCOPES.appCalendars] });
    expect((await authorizeCalendar(account, { interactive: true })).canListCalendars).toBe(false);
  });

  it("fails clearly if the app calendar scope wasn't granted", async () => {
    GoogleAuth.authorize.mockResolvedValue({ accessToken: "t", grantedScopes: [SCOPES.calendarList] });
    await expect(authorizeCalendar(account, { interactive: true })).rejects.toThrow(
      CalendarAccessDeniedError,
    );
  });
});

describe("createTokenProvider", () => {
  it("authorizes silently and clears the cached token before a forced refresh", async () => {
    GoogleAuth.authorize
      .mockResolvedValueOnce({ accessToken: "old", grantedScopes: CALENDAR_SCOPES })
      .mockResolvedValueOnce({ accessToken: "new", grantedScopes: CALENDAR_SCOPES });
    const getToken = createTokenProvider(account);

    expect(await getToken({ forceRefresh: false })).toBe("old");
    expect(await getToken({ forceRefresh: true })).toBe("new");
    expect(GoogleAuth.clearToken).toHaveBeenCalledWith("old");
    expect(GoogleAuth.authorize).toHaveBeenLastCalledWith(CALENDAR_SCOPES, account.email, false);
  });
});

describe("signOut / disconnect", () => {
  it("clears credential state and all local data on sign out", async () => {
    await AsyncStorage.setItem("eventbetter.calendarId", "cal");
    await signOut();
    expect(GoogleAuth.signOut).toHaveBeenCalled();
    expect(await AsyncStorage.getItem("eventbetter.calendarId")).toBeNull();
  });

  it("revokes access, then signs out", async () => {
    await disconnect(account);
    expect(GoogleAuth.revokeAccess).toHaveBeenCalledWith("user@example.com", CALENDAR_SCOPES);
    expect(GoogleAuth.signOut).toHaveBeenCalled();
  });

  it("still clears local state if revoking fails (e.g. offline)", async () => {
    GoogleAuth.revokeAccess.mockRejectedValue(new Error("offline"));
    await AsyncStorage.setItem("eventbetter.account", "{}");
    await expect(disconnect(account)).rejects.toThrow("offline");
    expect(await AsyncStorage.getItem("eventbetter.account")).toBeNull();
  });
});

describe("error helpers", () => {
  it("recognizes native error codes", () => {
    expect(isCancelled({ code: "ERR_SIGN_IN_CANCELLED" })).toBe(true);
    expect(isCancelled({ code: "ERR_AUTHORIZATION_CANCELLED" })).toBe(true);
    expect(needsInteractiveAuthorization({ code: "ERR_AUTHORIZATION_REQUIRED" })).toBe(true);
    expect(isCancelled(new Error("x"))).toBe(false);
  });
});
