import { Alert } from "react-native";

// Promise-based Alert: resolves true only if the user picks the action.
export function confirm(title, message, action, { destructive = false } = {}) {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: action, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

// Deleting a series removes every occurrence, so say how many.
export function confirmDeleteSeries(item) {
  const what = item.occurrenceCount ? `all ${item.occurrenceCount} of its occurrences` : "all of its occurrences";
  return confirm(
    `Delete "${item.name}"?`,
    `This removes ${what} from your EventBetter calendar. It can't be undone.`,
    "Delete",
    { destructive: true },
  );
}
