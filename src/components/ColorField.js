import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CLASSIC_COLORS, HUES, TONE_COUNT, hueIndexOf, textOn, toneRow } from "../lib/color";
import { Help } from "./FormFields";
import { radius, useTheme } from "./theme";

const CHIPS_PER_ROW = 5;

// Event color: ten hue swatches. Tapping one selects that hue's Google color and
// opens a row of its tones; tapping the open hue again closes the row. On
// accounts without Google's event labels (`supported === false`) a single row
// of the 11 classic colors replaces both. `supported` is null while checking.
// Swatches have spoken names, so nothing here prints a color name.
export function ColorField({ value, onChange, supported }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const hue = value ? hueIndexOf(value) : null;

  function onHuePress(index) {
    if (index === hue) setExpanded((open) => !open);
    else {
      onChange(HUES[index].hex);
      setExpanded(true);
    }
  }

  return (
    <View style={styles.wrap}>
      {supported === null ? <Help>Checking which colors your Google account supports…</Help> : null}

      {supported === true ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Hue" style={styles.chips}>
            {[HUES.slice(0, CHIPS_PER_ROW), HUES.slice(CHIPS_PER_ROW)].map((row, r) => (
              <View key={r} style={styles.chipRow}>
                {row.map((h, i) => {
                  const index = r * CHIPS_PER_ROW + i;
                  return (
                    <Swatch
                      key={h.name}
                      hex={h.hex}
                      label={h.name}
                      selected={hue === index}
                      expanded={hue === index ? expanded : undefined}
                      onPress={() => onHuePress(index)}
                      style={styles.chip}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {expanded && hue !== null ? (
            <>
              <View style={[styles.separator, { backgroundColor: t.fieldBorder }]} />
              <View accessibilityRole="radiogroup" accessibilityLabel={`${HUES[hue].name} tones`} style={styles.tones}>
                {toneRow(HUES[hue].hex).map((hex, i) => (
                  <Swatch
                    key={hex}
                    hex={hex}
                    label={`${HUES[hue].name}, tone ${i + 1} of ${TONE_COUNT}`}
                    selected={value === hex}
                    onPress={() => onChange(hex)}
                    style={styles.tone}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {supported === false ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Color" style={styles.classic}>
            {CLASSIC_COLORS.map((c) => (
              <Swatch
                key={c.id}
                hex={c.hex}
                label={c.name}
                selected={value === c.hex}
                onPress={() => onChange(c.hex)}
                style={styles.chip}
              />
            ))}
          </View>
          <Help>Your Google account doesn't offer the extended colors yet, so these are Calendar's 11 classic colors.</Help>
        </>
      ) : null}
    </View>
  );
}

// A selected swatch gets a check mark as well as a ring, so the choice never
// depends on color alone, and the mark flips between black and white to stay visible.
function Swatch({ hex, label, selected, expanded, onPress, style }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.swatch,
        style,
        { backgroundColor: hex, borderColor: selected ? t.text : t.fieldBorder },
        selected && styles.selected,
        pressed && { opacity: 0.8 },
      ]}
    >
      {selected ? <MaterialIcons name="check" size={22} color={textOn(hex)} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chips: { gap: 10 },
  chipRow: { flexDirection: "row", justifyContent: "space-between" },
  chip: { width: 48, height: 48, borderRadius: 24 },
  separator: { height: StyleSheet.hairlineWidth * 2, opacity: 0.6, marginVertical: 2 },
  tones: { flexDirection: "row", gap: 5 },
  tone: { flex: 1, height: 48, borderRadius: radius.field - 3 },
  classic: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
  selected: { borderWidth: 3 },
});
