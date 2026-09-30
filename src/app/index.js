import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, ErrorText, Row, Screen } from "../components/Screen";
import { useSession } from "../components/SessionProvider";
import { FREQUENCIES } from "../config/defaults";
import { toDateString } from "../lib/schedule";
import { buildOccurrences } from "../lib/series";
import { validate } from "../lib/validate";

// Minimal create form for milestone 2. The full form, list and settings screens
// come in milestone 3.
const PROGRESS_TEXT = {
  preparing: () => "Preparing…",
  creating: () => "Creating the series…",
  renaming: ({ done, total }) => `Naming events: ${done} of ${total}`,
  done: ({ total }) => `Done: ${total} events created`,
};

export default function Home() {
  const { account, service, signOut } = useSession();
  const [form, setForm] = useState({
    name: "",
    start: toDateString(new Date()),
    frequency: "monthly",
    interval: "1",
    maxCount: "12",
  });
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const preview = useMemo(() => {
    const { sub, valid } = validate(form);
    return valid ? buildOccurrences(sub).slice(0, 3) : [];
  }, [form]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await service.create(form, { onProgress: setProgress });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add subscription</Text>

        <Field label="Title" value={form.name} onChangeText={set("name")} placeholder="Give a title" />
        <Field
          label="Start date (YYYY-MM-DD)"
          value={form.start}
          onChangeText={set("start")}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Frequency</Text>
        <Row>
          {FREQUENCIES.map((f) => (
            <Button
              key={f}
              title={f}
              variant={form.frequency === f ? "primary" : "secondary"}
              onPress={() => set("frequency")(f)}
            />
          ))}
        </Row>
        <Field label="Repeat every" value={form.interval} onChangeText={set("interval")} keyboardType="number-pad" />
        <Field label="Number of events" value={form.maxCount} onChangeText={set("maxCount")} keyboardType="number-pad" />

        {preview.map((o) => (
          <Text key={o.n} style={styles.preview}>
            {toDateString(o.date)}: {o.title}
          </Text>
        ))}

        <Button title="Create events" onPress={onCreate} busy={busy} disabled={!service} />
        {progress && <Text>{PROGRESS_TEXT[progress.phase](progress)}</Text>}
        <ErrorText error={error} />

        <View style={styles.footer}>
          <Text style={styles.muted}>Signed in as {account?.email}</Text>
          <Button title="Sign out" variant="secondary" onPress={signOut} disabled={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "700" },
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  preview: { opacity: 0.7 },
  footer: { marginTop: 24, gap: 8 },
  muted: { opacity: 0.6 },
});
