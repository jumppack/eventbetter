import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DEFAULTS, FREQUENCIES, UNITS } from "../config/defaults";
import { classicIdFor, nearestClassic } from "../lib/color";
import { gridDate, isValidDateString, occurrences, parseDate, toDateString } from "../lib/schedule";
import { buildOccurrences } from "../lib/series";
import { validate } from "../lib/validate";
import { ColorField } from "./ColorField";
import {
  Bullet,
  ChoiceCards,
  Code,
  DateField,
  Disclosure,
  Field,
  Help,
  SegmentedField,
  SelectField,
  TextField,
} from "./FormFields";
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
    direction: DEFAULTS.direction,
    starting: DEFAULTS.starting,
    color: DEFAULTS.color,
    title: DEFAULTS.title,
    startTitle: "",
    endTitle: "",
  };
}

// `{units}` now agrees with the number before it, so the old singular-only
// `{unit}` is offered as `{units}` when an older event is edited.
const modernize = (template) => (template ?? "").replaceAll("{unit}", "{units}");

// Saved config (numbers) back to form values (strings) for the edit screen.
// An event saved without a color (empty) starts on the default in the form.
export function toFormValues(config) {
  return {
    ...emptyForm(),
    ...config,
    color: config.color || DEFAULTS.color,
    interval: String(config.interval),
    maxCount: String(config.maxCount),
    end: config.end ?? "",
    title: modernize(config.title),
    startTitle: modernize(config.startTitle),
    endTitle: modernize(config.endTitle),
  };
}

const formatDate = (date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// "1 month later", "2 weeks later", for the Starting option.
function laterLabel(interval, frequency) {
  const n = Number.isInteger(Number(interval)) && Number(interval) > 0 ? Number(interval) : 1;
  const unit = UNITS[frequency] ?? "period";
  return `${n} ${n === 1 ? unit : unit + "s"} later`;
}

// The dates the Numbering options and the start/end title help refer to.
// Null fields when the form can't be scheduled yet.
function layoutDates(sub, valid) {
  if (!valid) return { total: null, startDate: null, laterDate: null, endDate: null, endFree: false };
  const total = occurrences(sub).length;
  return {
    total,
    startDate: parseDate(sub.start),
    laterDate: gridDate(sub, 1),
    endDate: total > 0 ? gridDate(sub, total) : null,
    endFree: sub.starting === "start",
  };
}

const PROGRESS_TEXT = {
  preparing: () => "Preparing…",
  creating: () => "Creating the series…",
  renaming: ({ done, total }) => `Naming occurrences: ${done} of ${total}`,
  done: ({ total }) => `Done: ${total} occurrences added to your EventBetter calendar.`,
};

export const progressText = (p) => PROGRESS_TEXT[p.phase](p);

// The preview shows the first two items and the last, so countdowns and end
// titles are visible too.
const PREVIEW_HEAD = 2;

// Fields and help text follow the prototype's Index.html. `status` is
// { text, tone } shown under the button.
export function SeriesForm({ initial, submitLabel, onSubmit, busy, status, colorSupport = null }) {
  const [form, setForm] = useState(initial ?? emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Accounts without event labels only have the 11 classic colors, so a color
  // outside them moves to the nearest one.
  useEffect(() => {
    if (colorSupport === false && form.color && !classicIdFor(form.color)) {
      setForm((f) => ({ ...f, color: nearestClassic(f.color).hex }));
    }
  }, [colorSupport, form.color]);

  const { sub, errors, valid } = useMemo(() => validate(form), [form]);
  const preview = useMemo(() => {
    if (!valid) return [];
    try {
      return buildOccurrences(sub);
    } catch {
      return [];
    }
  }, [sub, valid]);
  const dates = useMemo(() => layoutDates(sub, valid), [sub, valid]);

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

      <Field label="Color" error={fieldError("color")}>
        <ColorField value={form.color} onChange={set("color")} supported={colorSupport} />
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

      <SectionHeading>Numbering</SectionHeading>

      <Field label="Count" error={fieldError("direction")}>
        <SegmentedField
          accessibilityLabel="Count"
          value={form.direction}
          onChange={set("direction")}
          options={[
            { value: "up", label: "Up", hint: "1, 2, 3" },
            { value: "down", label: "Down", hint: countdownHint(dates.total ?? sub.maxCount) },
          ]}
        />
      </Field>

      <Field label="Starting" error={fieldError("starting")}>
        <ChoiceCards
          accessibilityLabel="Starting"
          value={form.starting}
          onChange={set("starting")}
          options={[
            { value: "start", label: "On the start date", detail: firstOn(dates.startDate) },
            { value: "later", label: laterLabel(form.interval, form.frequency), detail: firstOn(dates.laterDate) },
          ]}
        />
      </Field>

      <Field label="Title template" help={<TemplateHelp />}>
        <TextField value={form.title} onChangeText={set("title")} autoCapitalize="none" autoCorrect={false} />
      </Field>

      <Field
        label="Start date title (optional)"
        help={<Help>{titleHelp(dates.startDate, dates.endFree, "1st")}</Help>}
      >
        <TextField
          value={form.startTitle}
          onChangeText={set("startTitle")}
          placeholder="{name} started"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Field
        label="End date title (optional)"
        help={<Help>{titleHelp(dates.endDate, !dates.endFree, "last")}</Help>}
      >
        <TextField
          value={form.endTitle}
          onChangeText={set("endTitle")}
          placeholder="{name} ended"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>

      <Preview items={preview} color={form.color} />

      <View style={styles.submit}>
        <PrimaryButton title={submitLabel} onPress={submit} busy={busy} />
      </View>
      {showErrors && !valid ? <StatusBox tone="error">Check the highlighted fields above.</StatusBox> : null}
      {status ? <StatusBox tone={status.tone}>{status.text}</StatusBox> : null}
    </View>
  );

}

const countdownHint = (total) =>
  Number.isInteger(total) && total >= 3 ? `${total}, ${total - 1}, ${total - 2}` : "… 3, 2, 1";

const firstOn = (date) => (date ? `1st occurrence on ${formatDate(date)}` : "Pick a start date first");

// Whether a start or end title adds an event or renames the occurrence that
// already falls on that date depends on the Starting option: "On the start
// date" occupies the start date and leaves the end date free, "later" the
// reverse.
function titleHelp(date, occupied, which) {
  const blank = " Leave blank to skip. The grey text is only a hint, not a value.";
  if (!date) return "Shown on that date." + blank;
  const effect = occupied ? `replaces the ${which} occurrence's title` : "adds one extra event";
  return `Shown on ${formatDate(date)}; ${effect}.` + blank;
}

function SectionHeading({ children }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

function Preview({ items, color }) {
  const t = useTheme();
  if (!items.length) return null;
  const hidden = items.length - PREVIEW_HEAD - 1;
  const rows = hidden > 0 ? [...items.slice(0, PREVIEW_HEAD), null, items.at(-1)] : items;
  return (
    <View style={[styles.preview, { backgroundColor: t.field, borderColor: t.fieldBorder }]}>
      <View style={styles.previewHeader}>
        <Text style={[styles.previewTitle, { color: t.muted }]}>Preview</Text>
        {color ? <View style={[styles.previewDot, { backgroundColor: color, borderColor: t.fieldBorder }]} /> : null}
      </View>
      {rows.map((o) =>
        o === null ? (
          <Text key="more" style={[styles.previewDate, { color: t.muted }]}>
            {`… ${hidden} more`}
          </Text>
        ) : (
          <View key={o.step} style={styles.previewRow}>
            <Text style={[styles.previewDate, { color: t.muted }]}>
              {formatDate(o.date) + (o.numbered ? "" : " · extra event")}
            </Text>
            <Text style={[styles.previewText, { color: t.text }]}>{o.title}</Text>
          </View>
        ),
      )}
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
        <Code>{"{count}"}</Code> occurrence number: 1, 2, 3 (or 12, 11, 10 when counting down)
      </Bullet>
      <Bullet>
        <Code>{"{ord}"}</Code> the same number as a position: 1st, 2nd, 3rd
      </Bullet>
      <Bullet>
        <Code>{"{units}"}</Code> day, week, month or year, matching the number before it: 1 month, 3 months, 3rd
        month
      </Bullet>
      <Help style={styles.note}>
        {"{count}"} counts occurrences, not time. With Repeats every 3 months, the 2nd occurrence is "2 months", so
        write your own word instead, like "quarter".
      </Help>
      <Disclosure title="Examples">
        <Bullet>
          <Code>{"{name}: {ord} {units} over"}</Code> → Tuff Gym membership: 3rd month over
        </Bullet>
        <Bullet>
          <Code>{"{name}: {ord} payment done"}</Code> with Starting on the start date → Rent: 1st payment done on the
          start date
        </Bullet>
        <Bullet>
          <Code>{"{name}: {count} {units} remaining"}</Code> with Count down → Tuff Gym membership: 12 months
          remaining … 1 month remaining
        </Bullet>
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 22, padding: 14, borderRadius: radius.field, borderWidth: 1, gap: 8 },
  previewTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  section: { marginTop: 28, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  note: { marginTop: 6 },
  previewRow: { gap: 2 },
  previewDate: { fontSize: 12 },
  previewText: { fontSize: 14, fontWeight: "500" },
  submit: { marginTop: 26 },
  inline: { flexDirection: "row", gap: 10 },
  interval: { width: 76, textAlign: "center" },
  unit: { flex: 1 },
});
