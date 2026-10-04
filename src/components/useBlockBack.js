import { useEffect } from "react";
import { BackHandler } from "react-native";

// Keeps the Android back button from leaving a screen mid-save, which would
// strand the save's own navigation afterwards.
export function useBlockBack(blocked) {
  useEffect(() => {
    if (!blocked) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [blocked]);
}
