import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DEFAULTS, FREQUENCIES, UNITS } from "../config/defaults";
import { isValidDateString, parseDate, toDateString } from "../lib/schedule";
import { buildOccurrences } from "../lib/series";
import { validate } from "../lib/validate";
import { Bullet, Code, DateField, Disclosure, Field, Help, SelectField, TextField } from "./FormFields";
import { PrimaryButton, StatusBox } from "./Glass";
import { radius, useTheme } from "./theme";

// Units for "Repeats every [n] [unit]", shortest period first, pluralized to
// match the number typed.
function unitOptions(interval) {
  const plural = Number(interval) !== 1;
  return FREQUENCIES.map((value) => ({ value, label: plural ? `${UNITS[value]}s` : UNITS[value] }));
}

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

// Saved config (numbers) back to form values (strings) for the edit screen.
export function toFormValues(config) {
  return {
    ...emptyForm(),
    ...config,
    interval: String(config.interval),
    maxCount: String(config.maxCount),
    end: config.end ?? "",
    startTitle: config.startTitle ?? "",
  };
}

const PROGRESS_TEXT = {
  preparing: () => "Preparing…",
  creating: () => "Creating the series…",
  renaming: ({ done, total }) => `Naming occurrences: ${done} of ${total}`,
  done: ({ total }) => `Done: ${total} occurrences added to your EventBetter calendar.`,
};

export const progressText = (p) => PROGRESS_TEXT[p.phase](p);

const PREVIEW_COUNT = 3;

// Fields and help text follow the prototype's Index.html. `status` is
// { text, tone } shown under the button.
export function SeriesForm({ initial, submitLabel, onSubmit, busy, status }) {
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

      <Field
        label="Repeats every"
        error={fieldError("interval") ?? fieldError("frequency")}
        help="For example, every 3 months is quarterly and every 2 weeks is fortnightly."
      >
        <View style={styles.inline}>
          <TextField
            value={form.interval}
            onChangeText={set("interval")}
            keyboardType="number-pad"
            accessibilityLabel="Repeats every, number"
            style={styles.interval}
            maxLength={3}
          />
          <View style={styles.unit}>
            <SelectField
              title="Repeats every"
              value={form.frequency}
              options={unitOptions(form.interval)}
              onChange={set("frequency")}
              accessibilityLabel="Repeats every, unit"
            />
          </View>
        </View>
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
        label="Number of occurrences"
        error={fieldError("maxCount")}
        help="How many occurrences to add to your calendar. If you set an End date, it stops at whichever comes first."
      >
        <TextField value={form.maxCount} onChangeText={set("maxCount")} keyboardType="number-pad" />
      </Field>

      <Field label="Title template" help={<TemplateHelp />}>
        <TextField value={form.title} onChangeText={set("title")} autoCapitalize="none" autoCorrect={false} />
      </Field>

      <Field
        label="Start date title (optional)"
        help={
          <Help>
            Adds one extra occurrence on the start date itself, e.g. <Code>{"{name} started"}</Code> → Tuff Gym
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
      <Help>The title each occurrence gets. Words in {"{ }"} are filled in automatically for every occurrence.</Help>
      <Bullet>
        <Code>{"{name}"}</Code> the Title above
      </Bullet>
      <Bullet>
        <Code>{"{count}"}</Code> occurrence number: 1, 2, 3
      </Bullet>
      <Bullet>
        <Code>{"{ord}"}</Code> occurrence number as a position: 1st, 2nd, 3rd
      </Bullet>
      <Bullet>
        <Code>{"{elapsed}"}</Code> total units passed: count × Repeats every
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
  inline: { flexDirection: "row", gap: 10 },
  interval: { width: 76, textAlign: "center" },
  unit: { flex: 1 },
});
