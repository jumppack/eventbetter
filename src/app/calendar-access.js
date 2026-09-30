import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isCancelled } from "../api/auth";
import { Button, ErrorText, Screen } from "../components/Screen";
import { useSession } from "../components/SessionProvider";

// Shown before the system consent screen, so the request isn't a surprise.
export default function CalendarAccess() {
  const { account, grantCalendar, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onAllow() {
    setBusy(true);
    setError(null);
    try {
      await grantCalendar();
    } catch (e) {
      if (__DEV__) {
        console.warn("Calendar authorization failed", e.code, e.message);
        setError(new Error(`${e.code ?? "error"}: ${e.message}`));
      } else if (!isCancelled(e)) {
        setError(e);
      }
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.center}>
      <View style={styles.body}>
        <Text style={styles.title}>Calendar access</Text>
        <Text style={styles.text}>
          EventBetter adds your subscriptions to its own calendar, named "EventBetter", in your
          Google Calendar. It can only create and change events in that calendar, never in your
          other calendars.
        </Text>
        <Text style={styles.text}>
          It also reads the names of your calendars, so it can find its own calendar again if you
          reinstall the app or switch phones.
        </Text>
        <Text style={styles.text}>
          Your calendar data stays between this device and Google. EventBetter has no server.
        </Text>
      </View>
      <Button title="Allow Calendar access" onPress={onAllow} busy={busy} />
      <Button
        title={`Not ${account?.email}? Use another account`}
        variant="secondary"
        onPress={signOut}
        disabled={busy}
      />
      <ErrorText error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center" },
  body: { gap: 12, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "700" },
  text: { fontSize: 16, lineHeight: 22 },
});
