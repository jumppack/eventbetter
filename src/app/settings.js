import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard, Screen, SecondaryButton, StatusBox, TopBar } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { useTheme } from "../components/theme";
import { LINKS } from "../config/links";

export default function Settings() {
  const t = useTheme();
  const { account, signOut, disconnect } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  function confirmDisconnect() {
    Alert.alert(
      "Disconnect Google account?",
      "EventBetter's access to your Google account is removed and this phone's app data is cleared. Your EventBetter calendar and its events stay in Google Calendar; delete the calendar there if you don't want it.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => run(disconnect) },
      ],
    );
  }

  return (
    <Screen>
      <TopBar title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Text style={[styles.primary, { color: t.text }]}>{account?.name || account?.email}</Text>
          {account?.name ? <Text style={[styles.secondary, { color: t.muted }]}>{account.email}</Text> : null}
          <View style={styles.actions}>
            <SecondaryButton title="Sign out" onPress={() => run(signOut)} disabled={busy} />
            <SecondaryButton
              title="Disconnect Google account"
              color={t.danger}
              onPress={confirmDisconnect}
              disabled={busy}
            />
          </View>
          <StatusBox tone="error">{error}</StatusBox>
        </Section>

        <Section title="About">
          <LinkRow label="Privacy policy" onPress={() => Linking.openURL(LINKS.privacyPolicy)} external />
          <LinkRow label="Homepage" onPress={() => Linking.openURL(LINKS.homepage)} external />
          <LinkRow label="Open-source licenses" onPress={() => router.push("/licenses")} />
          <Text style={[styles.secondary, styles.version, { color: t.muted }]}>
            Version {Constants.expoConfig?.version ?? "unknown"}
          </Text>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }) {
  const t = useTheme();
  return (
    <GlassCard style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.muted }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </GlassCard>
  );
}

function LinkRow({ label, onPress, external }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={external ? "link" : "button"}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { borderColor: t.fieldBorder }, pressed && { backgroundColor: t.field }]}
    >
      <Text style={[styles.linkText, { color: t.text }]}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 18 }}>{external ? "↗" : "›"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 48, gap: 12 },
  section: { paddingVertical: 20, gap: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  primary: { fontSize: 17, fontWeight: "600" },
  secondary: { fontSize: 14 },
  actions: { gap: 10, marginTop: 14 },
  linkRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  linkText: { fontSize: 16 },
  version: { marginTop: 14 },
});
