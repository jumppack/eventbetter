import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  authorizeCalendar,
  createTokenProvider,
  disconnect as googleDisconnect,
  getStoredAccount,
  needsInteractiveAuthorization,
  signIn as googleSignIn,
  signOut as googleSignOut,
} from "../api/auth";
import { createCalendarApi } from "../api/calendarApi";
import { reminders } from "../services/reminders";
import { createSeriesService } from "../services/seriesService";

// status: "loading" -> "signedOut" | "needsCalendar" | "ready"
const SessionContext = createContext(null);

export function useSession() {
  return useContext(SessionContext);
}

function buildService(account, canListCalendars) {
  const api = createCalendarApi({ getAccessToken: createTokenProvider(account) });
  return createSeriesService({ api, storage: AsyncStorage, canListCalendars });
}

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: "loading", account: null, service: null });

  const authorize = useCallback(async (account, interactive) => {
    const { canListCalendars } = await authorizeCalendar(account, { interactive });
    setState({ status: "ready", account, service: buildService(account, canListCalendars) });
  }, []);

  useEffect(() => {
    (async () => {
      const account = await getStoredAccount();
      if (!account) return setState({ status: "signedOut", account: null, service: null });
      try {
        await authorize(account, false);
      } catch (e) {
        if (!needsInteractiveAuthorization(e)) console.warn("Silent authorization failed", e);
        setState({ status: "needsCalendar", account, service: null });
      }
    })();
  }, [authorize]);

  const value = useMemo(
    () => ({
      ...state,
      async signIn() {
        const account = await googleSignIn();
        setState({ status: "needsCalendar", account, service: null });
      },
      grantCalendar: () => authorize(state.account, true),
      async signOut() {
        await reminders.clear();
        await googleSignOut();
        setState({ status: "signedOut", account: null, service: null });
      },
      // Revokes EventBetter's access in the Google account. Local state is
      // cleared even if revoking fails (e.g. offline), so sign out either way.
      async disconnect() {
        await reminders.clear().catch(() => {});
        try {
          await googleDisconnect(state.account);
        } finally {
          setState({ status: "signedOut", account: null, service: null });
        }
      },
    }),
    [state, authorize],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
