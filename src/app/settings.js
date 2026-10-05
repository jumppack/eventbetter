import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { privacyOptionsRequired, showPrivacyOptions } from "../ads/consent";
import { confirm } from "../components/confirm";
import { GlassCard, Screen, SecondaryButton, StatusBox, TopBar } from "../components/Glass";
import { useSession } from "../components/SessionProvider";
import { useSeries } from "../components/SeriesProvider";
import { useBlockBack } from "../components/useBlockBack";
import { useTheme } from "../components/theme";
import { LINKS } from "../config/links";
import { reminders } from "../services/reminders";

export default function Settings() {
  const t = useTheme();
  const { account, signOut } = useSession();
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

  return (
    <Screen>
      <TopBar title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Text style={[styles.primary, { color: t.text }]}>{account?.name || account?.email}</Text>
          {account?.name ? <Text style={[styles.secondary, { color: t.muted }]}>{account.email}</Text> : null}
          <View style={styles.actions}>
            <SecondaryButton title="Sign out" onPress={() => run(signOut)} disabled={busy} />
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

        <DangerZone />
      </ScrollView>
    </Screen>
  );
}

const countText = (items) => {
  const occurrences = items.reduce((sum, s) => sum + (s.occurrenceCount ?? 0), 0);
  const events = `${items.length} recurring event${items.length === 1 ? "" : "s"}`;
  return occurrences ? `${events} and their ${occurrences} occurrences` : events;
};

// Destructive actions, kept apart at the bottom. Both delete only what
// EventBetter created; the EventBetter calendar itself and anything the user
// added to it by hand stay in Google Calendar.
function DangerZone() {
  const t = useTheme();
  const { disconnect } = useSession();
  const { items, refresh, service } = useSeries();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  useBlockBack(busy);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const count = items?.length ?? 0;

  async function deleteAll() {
    setStatus({ text: `Deleting 0 of ${count}…`, tone: "normal" });
    await service.removeAll({
      onProgress: ({ done, total }) => setStatus({ text: `Deleting ${done} of ${total}…`, tone: "normal" }),
    });
  }

  async function run(action, doneText) {
    setBusy(true);
    try {
      await action();
      if (doneText) setStatus({ text: doneText, tone: "normal" });
    } catch (e) {
      setStatus({ text: e.message, tone: "error" });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function onDeleteAll() {
    const ok = await confirm(
      "Delete all recurring events?",
      `This removes ${countText(items)} from your EventBetter calendar. It can't be undone.`,
      "Delete all",
      { destructive: true },
    );
    if (ok) run(deleteAll, "All recurring events deleted.");
  }

  function onDisconnect() {
    const choices = [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect only", onPress: () => run(disconnect) },
    ];
    if (count) {
      choices.push({
        text: "Delete events too",
        style: "destructive",
        onPress: () =>
          run(async () => {
            await deleteAll();
            await disconnect();
          }),
      });
    }
    Alert.alert(
      "Disconnect Google account?",
      count
        ? `EventBetter's access to your Google account is removed and this phone's app data is cleared. You can also delete your ${countText(items)} first; otherwise they stay in Google Calendar.`
        : "EventBetter's access to your Google account is removed and this phone's app data is cleared.",
      choices,
    );
  }

  return (
    <Section title="Danger zone">
      <Text style={[styles.secondary, { color: t.muted }]}>
        These only affect what EventBetter created. The EventBetter calendar and anything you added to
        it yourself stay in Google Calendar.
      </Text>
      <View style={styles.actions}>
        <SecondaryButton
          title={count ? `Delete all recurring events (${count})` : "Delete all recurring events"}
          color={t.danger}
          onPress={onDeleteAll}
          disabled={busy || !count}
        />
        <SecondaryButton title="Disconnect Google account" color={t.danger} onPress={onDisconnect} disabled={busy} />
      </View>
      <StatusBox tone={status?.tone}>{status?.text}</StatusBox>
    </Section>
  );
}

// Calendar reminders are always on the series; this covers the extra local
// notifications, which need Android's notification permission.
function RemindersSection() {
  const t = useTheme();
  const { refresh } = useSeries();
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
          ? "You get a notification at 9:00 AM the day before each occurrence, for the next two occurrences of every recurring event."
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
        EventBetter is free and shows one banner ad on the recurring events list. Your calendar data and
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
