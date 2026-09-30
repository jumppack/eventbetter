import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isCancelled } from "../api/auth";
import { Button, ErrorText, Screen } from "../components/Screen";
import { useSession } from "../components/SessionProvider";

export default function SignIn() {
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
        setError(new Error(`${e.code ?? "error"}: ${e.message}`));
      } else if (!isCancelled(e)) {
        setError(e);
      }
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.center}>
      <View style={styles.hero}>
        <Text style={styles.title}>EventBetter</Text>
        <Text style={styles.subtitle}>
          Recurring Google Calendar events with a numbered title on every occurrence, so you can
          see how long you've been subscribed.
        </Text>
      </View>
      <Button title="Continue with Google" onPress={onPress} busy={busy} />
      <ErrorText error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center" },
  hero: { gap: 8, marginBottom: 16 },
  title: { fontSize: 34, fontWeight: "700" },
  subtitle: { fontSize: 16, lineHeight: 22, opacity: 0.8 },
});
