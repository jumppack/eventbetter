import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { useSession } from "./SessionProvider";

// The list screen loads subscriptions; add/edit/delete refresh them, and the
// edit screen reads from here instead of fetching again.
const SubscriptionsContext = createContext(null);

export function useSubscriptions() {
  return useContext(SubscriptionsContext);
}

// A new service means a new session (sign-out or another account), so the
// store remounts with it and never shows the previous account's list.
const sessionKeys = new WeakMap();
let nextKey = 1;

export function SubscriptionsProvider({ children }) {
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
      } catch (error) {
        setState((s) => ({ ...s, loading: false, error }));
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [service]);

  const value = useMemo(() => ({ ...state, refresh, service }), [state, refresh, service]);
  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>;
}
