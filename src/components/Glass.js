import { BlurTargetView, BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { createContext, useContext, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, useTheme } from "./theme";

// Frosted glass: cards blur the screen's background shapes. On Android the
// blurred content must live in a BlurTargetView that cards point at. The
// "Sdk31Plus" method uses RenderNode on Android 12+ and falls back to the
// plain translucent glass on older phones, which already meets AA contrast.
// Set to false to drop blur everywhere if it's slow on mid-range devices.
export const GLASS_BLUR = true;
const BLUR_METHOD = "dimezisBlurViewSdk31Plus";

const BlurTargetContext = createContext(null);

// Soft colored shapes behind the content, like the prototype's blurred blobs.
// Radial gradients give the same soft falloff without a blur pass.
export function Background({ children }) {
  const t = useTheme();
  const target = useRef(null);
  return (
    <View style={styles.fill}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]} 50%, ${t.bg[2]})` },
          ]}
        >
          <Blob color={t.blobs[0]} style={{ top: "-18%", left: "-35%" }} />
          <Blob color={t.blobs[1]} style={{ top: "30%", right: "-45%" }} />
          <Blob color={t.blobs[2]} style={{ bottom: "-22%", left: "5%" }} />
        </View>
      </BlurTargetView>
      {/* Content stays outside the target, or cards would blur themselves. */}
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </View>
  );
}

function Blob({ color, style }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.blob,
        { experimental_backgroundImage: `radial-gradient(circle, ${color} 0%, transparent 70%)` },
        style,
      ]}
    />
  );
}

export function Screen({ children, style }) {
  return (
    <Background>
      <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>
    </Background>
  );
}

export function GlassCard({ children, style }) {
  const t = useTheme();
  const target = useContext(BlurTargetContext);
  const blur = GLASS_BLUR && target;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: blur ? "transparent" : t.glass,
          borderColor: t.border,
          boxShadow: `${t.shadow}, inset 0px 1px 0px ${t.edge}`,
        },
        style,
      ]}
    >
      {blur ? (
        <>
          <BlurView
            blurTarget={target}
            blurMethod={BLUR_METHOD}
            intensity={60}
            tint={t.dark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          {/* Same tint as the unblurred glass, so contrast holds either way. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.glass }]} />
        </>
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius.card, experimental_backgroundImage: `linear-gradient(150deg, ${t.sheen}, transparent 38%)` },
        ]}
      />
      {children}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, busy }) {
  const t = useTheme();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          experimental_backgroundImage: `linear-gradient(135deg, ${t.buttonFrom}, ${t.buttonTo})`,
          boxShadow: "0px 8px 24px rgba(47, 91, 230, 0.35), inset 0px 1px 0px rgba(255, 255, 255, 0.45)",
          opacity: inactive ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View pointerEvents="none" style={styles.buttonSheen} />
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, color }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        { backgroundColor: pressed ? t.fieldFocus : t.field, borderColor: t.fieldBorder, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.secondaryText, { color: color ?? t.link }]}>{title}</Text>
    </Pressable>
  );
}

// Status line under the button, styled like the prototype's #status box.
export function StatusBox({ children, tone = "normal" }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <View style={[styles.status, { backgroundColor: t.field, borderColor: t.fieldBorder }]}>
      <Text style={{ fontSize: 14, color: tone === "error" ? t.danger : t.text }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1 },
  blob: { position: "absolute", width: "130%", aspectRatio: 1, opacity: 0.55 },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  button: {
    minHeight: 50,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  buttonSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    experimental_backgroundImage: "linear-gradient(to bottom, rgba(255, 255, 255, 0.28), transparent)",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondary: {
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  status: { marginTop: 16, padding: 14, borderRadius: radius.field, borderWidth: 1 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 16 },
  topBarTitle: { flex: 1, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  fabGlyph: { color: "#fff", fontSize: 32, lineHeight: 36, fontWeight: "400" },
});

// Screen header: optional back button, title, optional right-side action.
export function TopBar({ title, onBack, right }) {
  const t = useTheme();
  return (
    <View style={styles.topBar}>
      {onBack ? <IconButton glyph="‹" label="Back" onPress={onBack} size={30} /> : null}
      <Text style={[styles.topBarTitle, { color: t.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function IconButton({ glyph, label, onPress, size = 22 }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? t.fieldFocus : t.field, borderColor: t.border },
      ]}
    >
      <Text style={{ color: t.text, fontSize: size, lineHeight: size + 4 }}>{glyph}</Text>
    </Pressable>
  );
}

// Floating add button, bottom-right.
export function Fab({ label, onPress, bottom = 24 }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom,
          experimental_backgroundImage: `linear-gradient(135deg, ${t.buttonFrom}, ${t.buttonTo})`,
          boxShadow: "0px 8px 24px rgba(47, 91, 230, 0.4), inset 0px 1px 0px rgba(255, 255, 255, 0.45)",
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Text style={styles.fabGlyph}>+</Text>
    </Pressable>
  );
}

