import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from "react-native";

import { GlassCard, Screen, TopBar } from "../components/Glass";
import { emptyForm, progressText, SeriesForm } from "../components/SeriesForm";
import { useSeries } from "../components/SeriesProvider";
import { useBlockBack } from "../components/useBlockBack";
import { reminders } from "../services/reminders";
import { useTheme } from "../components/theme";

export default function AddSeries() {
  const t = useTheme();
  const { service, refresh } = useSeries();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  useBlockBack(busy);

  async function onSubmit(form) {
    setBusy(true);
    setStatus(null);
    try {
      await service.create(form, { onProgress: (p) => setStatus({ text: progressText(p), tone: "normal" }) });
      // The first recurring event is the natural moment to offer reminders.
      await reminders.askOnce().catch(() => {});
      await refresh();
      router.back();
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Add recurring event" onBack={busy ? undefined : () => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GlassCard>
            <Text style={[styles.subtitle, { color: t.muted }]}>
              Creates a recurring Google Calendar event where every occurrence gets its own numbered title, like "3rd month over".
            </Text>
            <SeriesForm
              initial={emptyForm()}
              submitLabel="Create events"
              onSubmit={onSubmit}
              busy={busy}
              status={status}
            />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 48 },
  subtitle: { fontSize: 14 },
});
