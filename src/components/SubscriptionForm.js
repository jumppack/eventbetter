import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DEFAULTS } from "../config/defaults";
import { isValidDateString, parseDate, toDateString } from "../lib/schedule";
import { buildOccurrences } from "../lib/series";
import { validate } from "../lib/validate";
import { Bullet, Code, DateField, Disclosure, Field, Help, SelectField, TextField } from "./FormFields";
import { PrimaryButton, StatusBox } from "./Glass";
import { radius, useTheme } from "./theme";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
  { value: "daily", label: "Daily" },
];

export function emptyForm() {
  return {
    name: "",
    start: toDateString(new Date()),
    frequency: DEFAULTS.frequency,
    interval: String(DEFAULTS.interval),
    end: "",
    maxCount: String(DEFAULTS.maxCount),
    title: DEFAULTS.title,
    startTitle: "",
  };
}

const PREVIEW_COUNT = 3;

// Fields and help text follow the prototype's Index.html. `status` is
// { text, tone } shown under the button.
export function SubscriptionForm({ initial, submitLabel, onSubmit, busy, status }) {
  const [form, setForm] = useState(initial ?? emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const { sub, errors, valid } = useMemo(() => validate(form), [form]);
  const preview = useMemo(() => {
    if (!valid) return [];
    try {
      return buildOccurrences({ ...sub, maxCount: Math.min(sub.maxCount, PREVIEW_COUNT + 1) }).slice(
        0,
        PREVIEW_COUNT,
      );
    } catch {
      return [];
    }
  }, [sub, valid]);

  const fieldError = (key) => (showErrors ? errors[key] : undefined);

  function submit() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    onSubmit(form);
  }

  return (
    <View>
      <Field label="Title" error={fieldError("name")}>
        <TextField
          value={form.name}
          onChangeText={set("name")}
          placeholder="Give a title"
          autoCapitalize="sentences"
          returnKeyType="done"
        />
      </Field>

      <Field label="Start date" error={fieldError("start")}>
        <DateField value={form.start} onChange={set("start")} />
      </Field>

      <Field label="Frequency" error={fieldError("frequency")}>
        <SelectField
          title="Frequency"
          value={form.frequency}
          options={FREQUENCY_OPTIONS}
          onChange={set("frequency")}
        />
      </Field>

      <Field
        label="Repeat every"
        error={fieldError("interval")}
        help="How many Frequency units between each event. 1 = every month, 3 = every 3 months (quarterly), 6 = every 6 months. With Weekly, 2 = every 2 weeks."
      >
        <TextField value={form.interval} onChangeText={set("interval")} keyboardType="number-pad" />
      </Field>

      <Field label="End date (optional)" error={fieldError("end")}>
        <DateField
          value={form.end}
          onChange={set("end")}
          placeholder="No end date"
          clearable
          minimumDate={isValidDateString(form.start) ? parseDate(form.start) : undefined}
        />
      </Field>

      <Field
        label="Number of events to create"
        error={fieldError("maxCount")}
        help="How many events to add to your calendar. If you set an End date, it stops at whichever comes first."
      >
        <TextField value={form.maxCount} onChangeText={set("maxCount")} keyboardType="number-pad" />
      </Field>

      <Field label="Title template" help={<TemplateHelp />}>
        <TextField value={form.title} onChangeText={set("title")} autoCapitalize="none" autoCorrect={false} />
      </Field>

      <Field
        label="Start event title (optional)"
        help={
          <Help>
            Adds one extra event on the start date itself, e.g. <Code>{"{name} started"}</Code> → Tuff Gym
            membership started. Leave blank to skip. The grey text is only a hint, not a value.
          </Help>
        }
      >
        <TextField
          value={form.startTitle}
          onChangeText={set("startTitle")}
          placeholder="{name} started"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Preview items={preview} />

      <View style={styles.submit}>
        <PrimaryButton title={submitLabel} onPress={submit} busy={busy} />
      </View>
      {showErrors && !valid ? <StatusBox tone="error">Check the highlighted fields above.</StatusBox> : null}
      {status ? <StatusBox tone={status.tone}>{status.text}</StatusBox> : null}
    </View>
  );

}

function Preview({ items }) {
  const t = useTheme();
  if (!items.length) return null;
  return (
    <View style={[styles.preview, { backgroundColor: t.field, borderColor: t.fieldBorder }]}>
      <Text style={[styles.previewTitle, { color: t.muted }]}>Preview</Text>
      {items.map((o) => (
        <View key={o.n} style={styles.previewRow}>
          <Text style={[styles.previewDate, { color: t.muted }]}>
            {o.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </Text>
          <Text style={[styles.previewText, { color: t.text }]}>{o.title}</Text>
        </View>
      ))}
    </View>
  );
}

function TemplateHelp() {
  return (
    <View>
      <Help>The name each event gets. Words in {"{ }"} are replaced automatically for every event.</Help>
      <Bullet>
        <Code>{"{name}"}</Code> the Title above
      </Bullet>
      <Bullet>
        <Code>{"{count}"}</Code> event number: 1, 2, 3
      </Bullet>
      <Bullet>
        <Code>{"{ord}"}</Code> event number as a position: 1st, 2nd, 3rd
      </Bullet>
      <Bullet>
        <Code>{"{elapsed}"}</Code> total units passed: count × Repeat every
      </Bullet>
      <Bullet>
        <Code>{"{unit}"}</Code> month, week, year or day
      </Bullet>
      <Bullet>
        <Code>{"{units}"}</Code> unit pluralised to match {"{elapsed}"}: 1 month, 2 months
      </Bullet>
      <Disclosure title="Examples">
        <Bullet>
          <Code>{"{name}: {ord} {unit} over"}</Code> → Tuff Gym membership: 3rd month over
        </Bullet>
        <Bullet>
          <Code>{"{name}: {elapsed} {units} done"}</Code> → Tuff Gym membership: 3 months done
        </Bullet>
        <Bullet>
          <Code>{"{name}: {ord} renewal, {elapsed} {units} in"}</Code> (repeat every 3) → Tuff Gym membership: 2nd
          renewal, 6 months in
        </Bullet>
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 22, padding: 14, borderRadius: radius.field, borderWidth: 1, gap: 8 },
  previewTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  previewRow: { gap: 2 },
  previewDate: { fontSize: 12 },
  previewText: { fontSize: 14, fontWeight: "500" },
  submit: { marginTop: 26 },
});
