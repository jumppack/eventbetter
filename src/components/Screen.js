import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Minimal building blocks for milestone 2. The glass design comes in milestone 6.

export function Screen({ children, style }) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function Button({ title, onPress, disabled, busy, variant = "primary" }) {
  const secondary = variant === "secondary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (disabled || busy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? "#4f46e5" : "#fff"} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <Text style={styles.error}>{error.message ?? String(error)}</Text>;
}

export function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#4f46e5" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#4f46e5" },
  error: { color: "#dc2626" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
