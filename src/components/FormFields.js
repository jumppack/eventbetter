import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { parseDate, toDateString } from "../lib/schedule";
import { radius, useTheme } from "./theme";

const MONO = Platform.select({ android: "monospace", default: "Menlo" });

export function Field({ label, help, error, children }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {children}
      {error ? <Text style={[styles.help, { color: t.danger }]}>{error}</Text> : null}
      {typeof help === "string" ? <Help>{help}</Help> : help}
    </View>
  );
}

export function Help({ children, style }) {
  const t = useTheme();
  return <Text style={[styles.help, { color: t.muted }, style]}>{children}</Text>;
}

// Inline `{placeholder}` chip, like <code> in the prototype's help text.
export function Code({ children }) {
  const t = useTheme();
  return (
    <Text style={[styles.code, { color: t.text, backgroundColor: t.codeBg }]}>{` ${children} `}</Text>
  );
}

export function Bullet({ children }) {
  const t = useTheme();
  return (
    <View style={styles.bullet}>
      <Text style={[styles.help, styles.dot, { color: t.muted }]}>•</Text>
      <Help style={styles.bulletText}>{children}</Help>
    </View>
  );
}

// Collapsible section, like the prototype's <details>.
export function Disclosure({ title, children }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        hitSlop={12}
        style={styles.disclosure}
      >
        <Text style={[styles.disclosureText, { color: t.link }]}>{`${open ? "▾" : "▸"} ${title}`}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function useFieldStyle(focused) {
  const t = useTheme();
  return [
    styles.input,
    {
      color: t.text,
      backgroundColor: focused ? t.fieldFocus : t.field,
      borderColor: focused ? t.link : t.fieldBorder,
      boxShadow: focused ? `0px 0px 0px 4px ${t.ring}` : "inset 0px 1px 2px rgba(0, 0, 0, 0.06)",
    },
  ];
}

export function TextField(props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const fieldStyle = useFieldStyle(focused);
  return (
    <TextInput
      placeholderTextColor={t.placeholder}
      selectionColor={t.accent}
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[fieldStyle, props.style]}
    />
  );
}

const formatDate = (value) =>
  parseDate(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Stores YYYY-MM-DD strings; opens the native Android date dialog.
export function DateField({ value, onChange, placeholder = "Select a date", clearable, minimumDate }) {
  const t = useTheme();
  const fieldStyle = useFieldStyle(false);

  function open() {
    DateTimePickerAndroid.open({
      mode: "date",
      value: value ? parseDate(value) : minimumDate ?? new Date(),
      minimumDate,
      onValueChange: (_event, date) => date && onChange(toDateString(date)),
      ...(clearable && value && {
        neutralButton: { label: "Clear" },
        onNeutralButtonPress: () => onChange(""),
      }),
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens a date picker"
      onPress={open}
      style={[fieldStyle, styles.row]}
    >
      <Text style={[styles.value, { color: value ? t.text : t.placeholder }]}>
        {value ? formatDate(value) : placeholder}
      </Text>
      <Text style={[styles.icon, { color: t.muted }]}>📅</Text>
    </Pressable>
  );
}

// A dropdown that opens a sheet of options, like the prototype's <select>.
export function SelectField({ value, options, onChange, title }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const fieldStyle = useFieldStyle(open);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={[fieldStyle, styles.row]}>
        <Text style={[styles.value, { color: t.text }]}>{current?.label}</Text>
        <Text style={[styles.chevron, { color: t.muted }]}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: t.scrim }]} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: t.sheet, borderColor: t.border }]}>
            <Text style={[styles.sheetTitle, { color: t.muted }]}>{title}</Text>
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: t.field }]}
                >
                  <Text style={[styles.optionText, { color: selected ? t.link : t.text }]}>{o.label}</Text>
                  {selected ? <Text style={{ color: t.link, fontSize: 16 }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 18, gap: 6 },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.13 },
  help: { fontSize: 12.5, lineHeight: 19 },
  code: { fontFamily: MONO, fontSize: 12 },
  bullet: { flexDirection: "row", paddingLeft: 4, marginTop: 2 },
  dot: { width: 14 },
  bulletText: { flex: 1 },
  disclosure: { marginTop: 6, alignSelf: "flex-start" },
  disclosureText: { fontSize: 13, fontWeight: "600" },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: radius.field,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { fontSize: 15 },
  icon: { fontSize: 16 },
  chevron: { fontSize: 18, marginTop: -6 },
  scrim: { flex: 1, justifyContent: "flex-end", padding: 16 },
  sheet: { borderRadius: radius.card, borderWidth: 1, paddingVertical: 8, overflow: "hidden" },
  sheetTitle: { fontSize: 13, fontWeight: "600", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  option: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: { fontSize: 16 },
});
