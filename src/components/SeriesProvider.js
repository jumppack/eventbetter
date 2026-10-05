import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { reminders } from "../services/reminders";
import { useSession } from "./SessionProvider";

// The list screen loads the recurring events; add/edit/delete refresh them, and the
// edit screen reads from here instead of fetching again.
const SeriesContext = createContext(null);

export function useSeries() {
  return useContext(SeriesContext);
}

// A new service means a new session (sign-out or another account), so the
// store remounts with it and never shows the previous account's list.
const sessionKeys = new WeakMap();
let nextKey = 1;

export function SeriesProvider({ children }) {
  const { service } = useSession();
  if (service && !sessionKeys.has(service)) sessionKeys.set(service, nextKey++);
  return (
    <Store key={service ? sessionKeys.get(service) : 0} service={service}>
      {children}
    </Store>
  );
}

function Store({ service, children }) {
  const [state, setState] = useState({ items: null, loading: false, error: null });
  const inFlight = useRef(null);

  const refresh = useCallback(() => {
    if (!service) return Promise.resolve();
    // Focus events can fire in quick succession; share one request.
    inFlight.current ??= (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const items = await service.list();
        setState({ items, loading: false, error: null });
        // Every refresh re-derives local reminders from Calendar data.
        reminders.sync(items).catch((e) => console.warn("Reminder sync failed", e));
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error }));
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [service]);

  // Coming back to the app re-reads Calendar, which also reschedules reminders.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => next === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh, service }), [state, refresh, service]);
  return <SeriesContext.Provider value={value}>{children}</SeriesContext.Provider>;
}
