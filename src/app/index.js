import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { BannerSlot } from "../components/BannerSlot";
import { Fab, GlassCard, IconButton, PrimaryButton, Screen, StatusBox, TopBar } from "../components/Glass";
import { useSubscriptions } from "../components/SubscriptionsProvider";
import { radius, useTheme } from "../components/theme";

const formatDate = (date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function Subscriptions() {
  const t = useTheme();
  const { items, loading, error, refresh } = useSubscriptions();

  // Reload whenever the list comes back into view, e.g. after add or edit.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const firstLoad = items === null;

  return (
    <Screen>
      <TopBar
        title="Subscriptions"
        right={<IconButton glyph="⚙︎" label="Settings" onPress={() => router.push("/settings")} />}
      />
      <View style={styles.flex}>
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SubscriptionRow item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading && !firstLoad}
              onRefresh={refresh}
              colors={[t.buttonFrom]}
              progressBackgroundColor={t.sheet}
            />
          }
          ListHeaderComponent={
            error ? <StatusBox tone="error">{error.message} Pull down to try again.</StatusBox> : null
          }
          ListEmptyComponent={firstLoad ? <Loading /> : error ? null : <EmptyState />}
        />
        {items?.length ? <Fab label="Add subscription" onPress={() => router.push("/add")} /> : null}
      </View>
      <BannerSlot />
    </Screen>
  );
}

function SubscriptionRow({ item }) {
  const t = useTheme();
  const details = item.editable
    ? `${item.frequencyLabel} · ${item.done} of ${item.total}`
    : "Settings unavailable, can only be deleted";
  const next = item.completed ? "Completed" : item.next ? `Next: ${formatDate(item.next.date)}` : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the subscription to edit or delete it"
      onPress={() => router.push(`/edit/${encodeURIComponent(item.id)}`)}
      style={({ pressed }) => [styles.rowWrap, pressed && styles.pressed]}
    >
      <GlassCard style={styles.row}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.meta, { color: t.muted }]}>{details}</Text>
        {next ? <Text style={[styles.meta, { color: t.text }]}>{next}</Text> : null}
        {item.editable && item.total ? <ProgressBar done={item.done} total={item.total} /> : null}
      </GlassCard>
    </Pressable>
  );
}

function ProgressBar({ done, total }) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.field, borderColor: t.fieldBorder }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round((done / total) * 100)}%`,
            experimental_backgroundImage: `linear-gradient(90deg, ${t.buttonFrom}, ${t.buttonTo})`,
          },
        ]}
      />
    </View>
  );
}

function EmptyState() {
  const t = useTheme();
  return (
    <GlassCard>
      <Text style={[styles.emptyTitle, { color: t.text }]}>No subscriptions yet</Text>
      <Text style={[styles.emptyText, { color: t.muted }]}>
        Add a gym membership, a streaming plan or anything you renew. EventBetter puts a recurring
        event in your Google Calendar where every occurrence has its own title, like "Tuff Gym
        membership: 3rd month over", so you can see how long you've been subscribed.
      </Text>
      <PrimaryButton title="Add subscription" onPress={() => router.push("/add")} />
    </GlassCard>
  );
}

function Loading() {
  const t = useTheme();
  return <Text style={[styles.loading, { color: t.muted }]}>Loading your subscriptions…</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, paddingBottom: 120, gap: 12, flexGrow: 1 },
  rowWrap: { borderRadius: radius.card },
  pressed: { opacity: 0.85 },
  row: { paddingVertical: 18, gap: 4 },
  name: { fontSize: 17, fontWeight: "600" },
  meta: { fontSize: 14 },
  track: { height: 8, borderRadius: 4, borderWidth: 1, marginTop: 10, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptyText: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22 },
  loading: { textAlign: "center", marginTop: 40, fontSize: 15 },
});
