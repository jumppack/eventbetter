import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard, Screen, SecondaryButton } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { emptyForm, SubscriptionForm } from "../components/SubscriptionForm";
import { useTheme } from "../components/theme";

// Add form for now; milestone 3 turns this into the subscriptions list and
// moves the form to its own add/edit screen.
const PROGRESS_TEXT = {
  preparing: () => "Preparing…",
  creating: () => "Creating the series…",
  renaming: ({ done, total }) => `Naming events: ${done} of ${total}`,
  done: ({ total }) => `Done: ${total} events added to your EventBetter calendar.`,
};

export default function Home() {
  const t = useTheme();
  const { account, service, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(form) {
    setBusy(true);
    setStatus(null);
    try {
      await service.create(form, {
        onProgress: (p) => setStatus({ text: PROGRESS_TEXT[p.phase](p), tone: "normal" }),
      });
      setFormKey((k) => k + 1); // fresh form for the next subscription
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GlassCard>
            <Text style={[styles.title, { color: t.text }]}>Add subscription</Text>
            <Text style={[styles.subtitle, { color: t.muted }]}>
              Creates numbered events so you can see how long you've been subscribed.
            </Text>
            <SubscriptionForm
              key={formKey}
              initial={emptyForm()}
              submitLabel="Create events"
              onSubmit={onSubmit}
              busy={busy}
              status={status}
            />
          </GlassCard>

          <View style={styles.footer}>
            <Text style={[styles.muted, { color: t.muted }]}>Signed in as {account?.email}</Text>
            <SecondaryButton title="Sign out" onPress={signOut} disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 6 },
  footer: { marginTop: 20, gap: 10, paddingHorizontal: 8 },
  muted: { fontSize: 13, textAlign: "center" },
});
