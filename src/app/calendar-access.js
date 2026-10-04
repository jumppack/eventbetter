import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isCancelled } from "../api/auth";
import { GlassCard, PrimaryButton, Screen, SecondaryButton, StatusBox } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { useTheme } from "../components/theme";

// Shown before the system consent screen, so the request isn't a surprise.
export default function CalendarAccess() {
  const t = useTheme();
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
        setError(`${e.code ?? "error"}: ${e.message}`);
      } else if (!isCancelled(e)) {
        setError(e.message);
      }
      setBusy(false);
    }
  }

  const text = [styles.text, { color: t.text }];
  return (
    <Screen style={styles.center}>
      <GlassCard>
        <Text style={[styles.title, { color: t.text }]}>Calendar access</Text>
        <View style={styles.body}>
          <Text style={text}>
            EventBetter adds your subscriptions to its own calendar, named "EventBetter", in your
            Google Calendar. It can only create and change events in that calendar, never in your
            other calendars.
          </Text>
          <Text style={text}>
            It also reads the names of your calendars, so it can find its own calendar again if you
            reinstall the app or switch phones.
          </Text>
          <Text style={[styles.text, { color: t.muted }]}>
            Your calendar data stays between this device and Google. EventBetter has no server.
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton title="Allow Calendar access" onPress={onAllow} busy={busy} />
          <SecondaryButton
            title={`Not ${account?.email}? Use another account`}
            onPress={signOut}
            disabled={busy}
          />
        </View>
        <StatusBox tone="error">{error}</StatusBox>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", padding: 12 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  body: { gap: 12, marginTop: 14, marginBottom: 22 },
  text: { fontSize: 15, lineHeight: 22 },
  actions: { gap: 10 },
});
