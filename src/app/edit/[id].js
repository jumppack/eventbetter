import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard, Screen, SecondaryButton, StatusBox, TopBar } from "../../components/Glass";
import { progressText, SubscriptionForm, toFormValues } from "../../components/SubscriptionForm";
import { useSubscriptions } from "../../components/SubscriptionsProvider";
import { useBlockBack } from "../../components/useBlockBack";
import { useTheme } from "../../components/theme";

const confirm = (title, message, action, destructive = false) =>
  new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );

export default function EditSubscription() {
  const t = useTheme();
  const { id } = useLocalSearchParams();
  const { items, service, refresh } = useSubscriptions();
  const [subscription, setSubscription] = useState(() => items?.find((s) => s.id === id));
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  useBlockBack(busy);

  // Opened without the list loaded (e.g. after a reload): fetch it directly.
  useEffect(() => {
    if (subscription || !service) return;
    service
      .get(id)
      .then((s) => (s ? setSubscription(s) : setLoadError(new Error("This subscription no longer exists."))))
      .catch(setLoadError);
  }, [id, service, subscription]);

  async function onSave(form) {
    const count = subscription.total;
    const ok = await confirm(
      "Replace this subscription?",
      `EventBetter will create the updated events in your calendar, then delete the current ${count} events. Occurrence titles are all custom, so they can't be changed in place.`,
      "Replace",
    );
    if (!ok) return;

    setBusy(true);
    setStatus(null);
    try {
      await service.update(subscription.id, form, {
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
    const ok = await confirm(
      `Delete "${subscription.name}"?`,
      "This removes all of its events from your EventBetter calendar. It can't be undone.",
      "Delete",
      true,
    );
    if (!ok) return;

    setBusy(true);
    setStatus({ text: "Deleting…", tone: "normal" });
    try {
      await service.remove(subscription.id);
      await refresh();
      router.back();
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Edit subscription" onBack={busy ? undefined : () => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loadError ? <StatusBox tone="error">{loadError.message}</StatusBox> : null}
          {!subscription && !loadError ? <Text style={[styles.muted, { color: t.muted }]}>Loading…</Text> : null}

          {subscription ? (
            <GlassCard>
              {subscription.editable ? (
                <SubscriptionForm
                  initial={toFormValues(subscription.config)}
                  submitLabel="Save changes"
                  onSubmit={onSave}
                  busy={busy}
                  status={status}
                />
              ) : (
                <>
                  <Text style={[styles.title, { color: t.text }]}>{subscription.name}</Text>
                  <Text style={[styles.muted, { color: t.muted }]}>
                    This subscription's saved settings can't be read, so it can't be edited. You can
                    delete it and add it again.
                  </Text>
                  <StatusBox tone={status?.tone}>{status?.text}</StatusBox>
                </>
              )}
              <View style={styles.delete}>
                <SecondaryButton
                  title="Delete subscription"
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
