import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { privacyOptionsRequired, showPrivacyOptions } from "../ads/consent";
import { GlassCard, Screen, SecondaryButton, StatusBox, TopBar } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { useSubscriptions } from "../components/SubscriptionsProvider";
import { useTheme } from "../components/theme";
import { LINKS } from "../config/links";
import { reminders } from "../services/reminders";

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

        <RemindersSection />

        <AdPrivacySection />

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

// Calendar reminders are always on the series; this covers the extra local
// notifications, which need Android's notification permission.
function RemindersSection() {
  const t = useTheme();
  const { refresh } = useSubscriptions();
  const [permission, setPermission] = useState(null);

  const check = useCallback(() => {
    reminders.getPermission().then(setPermission).catch(() => {});
  }, []);

  // Re-check on focus and when returning from system settings.
  useFocusEffect(check);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => sub.remove();
  }, [check]);

  async function turnOn() {
    if (permission?.canAskAgain) {
      const result = await reminders.request();
      setPermission(result);
      if (result.granted) refresh();
    } else {
      Linking.openSettings();
    }
  }

  const on = permission?.granted;
  return (
    <Section title="Reminders">
      <Text style={[styles.primary, { color: t.text }]}>
        {on ? "Notifications are on" : "Notifications are off"}
      </Text>
      <Text style={[styles.secondary, { color: t.muted }]}>
        {on
          ? "You get a notification at 9:00 AM the day before each event, for the next two events of every subscription."
          : "Google Calendar still reminds you the day before. Turn on notifications to also get them from EventBetter."}
      </Text>
      {permission && !on ? (
        <View style={styles.actions}>
          <SecondaryButton
            title={permission.canAskAgain ? "Turn on notifications" : "Open system settings"}
            onPress={turnOn}
          />
        </View>
      ) : null}
      {__DEV__ && on ? (
        <View style={styles.actions}>
          <SecondaryButton title="Send a test reminder in 10 seconds" onPress={() => reminders.sendTest()} />
        </View>
      ) : null}
    </Section>
  );
}

// The consent SDK decides whether the user's region needs this (EEA/UK,
// some US states); elsewhere there's nothing to manage.
function AdPrivacySection() {
  const t = useTheme();
  const [required, setRequired] = useState(null);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      privacyOptionsRequired().then(setRequired);
    }, []),
  );

  async function open() {
    setError(null);
    try {
      await showPrivacyOptions();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Section title="Ads">
      <Text style={[styles.secondary, { color: t.muted }]}>
        EventBetter is free and shows one banner ad on the subscriptions list. Your calendar data and
        Google account details are never shared with the ad network.
      </Text>
      {required ? (
        <View style={styles.actions}>
          <SecondaryButton title="Manage ad privacy choices" onPress={open} />
        </View>
      ) : (
        <Text style={[styles.secondary, styles.note, { color: t.muted }]}>
          {required === false ? "No ad privacy choices are needed in your region." : ""}
        </Text>
      )}
      <StatusBox tone="error">{error}</StatusBox>
    </Section>
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
  note: { marginTop: 10 },
});
