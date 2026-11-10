import { useEffect, useState } from "react";

// Whether the signed-in account supports Google's event labels: null while
// checking, then true or false. A failed check counts as false for now (the 11
// classic colors work on every account) and is retried the next time a form opens.
export function useColorSupport(service) {
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    if (!service) return undefined;
    let current = true;
    service
      .getColorSupport()
      .then((result) => current && setSupported(result))
      .catch(() => current && setSupported(false));
    return () => {
      current = false;
    };
  }, [service]);

  return supported;
}
