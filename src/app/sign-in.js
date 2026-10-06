import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { isCancelled } from "../api/auth";
import { GlassCard, PrimaryButton, Screen, StatusBox } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { useTheme } from "../components/theme";

export default function SignIn() {
  const t = useTheme();
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onPress() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      // Google reports some setup problems (OAuth client, SHA-1, test users)
      // as a cancellation, so show everything while developing.
      if (__DEV__) {
        console.warn("Sign-in failed", e.code, e.message);
        setError(`${e.code ?? "error"}: ${e.message}`);
      } else if (!isCancelled(e)) {
        setError(e.message);
      }
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.center}>
      <GlassCard style={styles.card}>
        <Text style={[styles.title, { color: t.text }]}>EventBetter</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>
          Recurring Google Calendar events with a numbered title on every occurrence, so you can see
          at a glance how far along you are.
        </Text>
        <PrimaryButton title="Continue with Google" onPress={onPress} busy={busy} />
        <StatusBox tone="error">{error}</StatusBox>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", padding: 12 },
  card: { gap: 4 },
  title: { fontSize: 32, fontWeight: "700", letterSpacing: -0.6 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 22 },
});
