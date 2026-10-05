import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";

import { confirm, confirmDeleteSeries } from "../../components/confirm";
import { GlassCard, Screen, SecondaryButton, StatusBox, TopBar } from "../../components/Glass";
import { progressText, SeriesForm, toFormValues } from "../../components/SeriesForm";
import { useSeries } from "../../components/SeriesProvider";
import { useBlockBack } from "../../components/useBlockBack";
import { useTheme } from "../../components/theme";

export default function EditSeries() {
  const t = useTheme();
  const { id } = useLocalSearchParams();
  const { items, service, refresh } = useSeries();
  const [series, setSeries] = useState(() => items?.find((s) => s.id === id));
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  useBlockBack(busy);

  // Opened without the list loaded (e.g. after a reload): fetch it directly.
  useEffect(() => {
    if (series || !service) return;
    service
      .get(id)
      .then((s) => (s ? setSeries(s) : setLoadError(new Error("This recurring event no longer exists."))))
      .catch(setLoadError);
  }, [id, service, series]);

  async function onSave(form) {
    const count = series.occurrenceCount;
    const ok = await confirm(
      "Replace this recurring event?",
      `EventBetter will create the updated occurrences in your calendar, then delete the current ${count}. Every occurrence has its own title, so they can't be changed in place.`,
      "Replace",
    );
    if (!ok) return;

    setBusy(true);
    setStatus(null);
    try {
      await service.update(series.id, form, {
        onProgress: (p) => setStatus({ text: progressText(p), tone: "normal" }),
      });
      await refresh();
      router.back();
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
      setBusy(false);
      refresh();
    }
  }

  async function onDelete() {
    if (!(await confirmDeleteSeries(series))) return;

    setBusy(true);
    setStatus({ text: "Deleting…", tone: "normal" });
    try {
      await service.remove(series.id);
      await refresh();
      router.back();
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Edit recurring event" onBack={busy ? undefined : () => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loadError ? <StatusBox tone="error">{loadError.message}</StatusBox> : null}
          {!series && !loadError ? <Text style={[styles.muted, { color: t.muted }]}>Loading…</Text> : null}

          {series ? (
            <GlassCard>
              {series.editable ? (
                <SeriesForm
                  initial={toFormValues(series.config)}
                  submitLabel="Save changes"
                  onSubmit={onSave}
                  busy={busy}
                  status={status}
                />
              ) : (
                <>
                  <Text style={[styles.title, { color: t.text }]}>{series.name}</Text>
                  <Text style={[styles.muted, { color: t.muted }]}>
                    This event's saved settings can't be read, so it can't be edited. You can
                    delete it and add it again.
                  </Text>
                  <StatusBox tone={status?.tone}>{status?.text}</StatusBox>
                </>
              )}
              <View style={styles.delete}>
                <SecondaryButton
                  title="Delete recurring event"
                  color={t.danger}
                  onPress={onDelete}
                  disabled={busy}
                />
              </View>
            </GlassCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: "700" },
  muted: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  delete: { marginTop: 14 },
});
