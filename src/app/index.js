import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { BannerSlot } from "../components/BannerSlot";
import { confirmDeleteSeries } from "../components/confirm";
import { Fab, GlassCard, IconButton, PrimaryButton, Screen, StatusBox, TopBar } from "../components/Glass";
import { useSeries } from "../components/SeriesProvider";
import { radius, useTheme } from "../components/theme";

const formatDate = (date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const editPath = (item) => `/edit/${encodeURIComponent(item.id)}`;

export default function SeriesList() {
  const t = useTheme();
  const { items, loading, error, refresh, service } = useSeries();
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Reload whenever the list comes back into view, e.g. after add or edit.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function onDelete(item) {
    if (!(await confirmDeleteSeries(item))) return;
    setDeleting(item.id);
    setDeleteError(null);
    try {
      await service.remove(item.id);
      await refresh();
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  const firstLoad = items === null;
  const message = error ? `${error.message} Pull down to try again.` : deleteError;

  return (
    <Screen>
      <TopBar
        title="Recurring events"
        right={<IconButton icon="settings" label="Settings" onPress={() => router.push("/settings")} />}
      />
      <View style={styles.flex}>
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SeriesRow item={item} deleting={deleting === item.id} disabled={!!deleting} onDelete={onDelete} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading && !firstLoad}
              onRefresh={refresh}
              colors={[t.buttonFrom]}
              progressBackgroundColor={t.sheet}
            />
          }
          ListHeaderComponent={message ? <StatusBox tone="error">{message}</StatusBox> : null}
          ListEmptyComponent={firstLoad ? <Loading /> : error ? null : <EmptyState />}
        />
        {items?.length ? <Fab label="Add recurring event" onPress={() => router.push("/add")} /> : null}
      </View>
      <BannerSlot />
    </Screen>
  );
}

// Tapping anywhere on the card opens edit; the icons are explicit shortcuts.
function SeriesRow({ item, deleting, disabled, onDelete }) {
  const t = useTheme();
  const details = item.editable
    ? `${item.frequencyLabel} · ${item.done} of ${item.total} occurrences`
    : "Settings unavailable, can only be deleted";
  let next = null;
  if (deleting) next = "Deleting…";
  else if (item.completed) next = "Completed";
  else if (item.next) next = `Next: ${formatDate(item.next.date)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${details}`}
      accessibilityHint="Opens the event to edit it"
      onPress={() => router.push(editPath(item))}
      disabled={disabled}
      style={({ pressed }) => [styles.rowWrap, (pressed || deleting) && styles.pressed]}
    >
      <GlassCard style={styles.row}>
        <View style={styles.rowTop}>
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.meta, { color: t.muted }]}>{details}</Text>
            {next ? <Text style={[styles.meta, { color: t.text }]}>{next}</Text> : null}
          </View>
          <View style={styles.actions}>
            {item.editable ? (
              <IconButton
                icon="edit"
                label={`Edit ${item.name}`}
                onPress={() => router.push(editPath(item))}
                disabled={disabled}
                plain
              />
            ) : null}
            <IconButton
              icon="delete-outline"
              label={`Delete ${item.name}`}
              onPress={() => onDelete(item)}
              color={t.danger}
              disabled={disabled}
              plain
            />
          </View>
        </View>
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
      <Text style={[styles.emptyTitle, { color: t.text }]}>No recurring events yet</Text>
      <Text style={[styles.emptyText, { color: t.muted }]}>
        Google Calendar gives every occurrence of a recurring event the same title. EventBetter gives
        each one its own numbered title, like "Tuff Gym membership: 3rd month over", so you can see at
        a glance how far along you are. Use it for memberships, habits, milestones or anything that
        repeats.
      </Text>
      <PrimaryButton title="Add recurring event" onPress={() => router.push("/add")} />
    </GlassCard>
  );
}

function Loading() {
  const t = useTheme();
  return <Text style={[styles.loading, { color: t.muted }]}>Loading your recurring events…</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, paddingBottom: 120, gap: 12, flexGrow: 1 },
  rowWrap: { borderRadius: radius.card },
  pressed: { opacity: 0.85 },
  row: { paddingVertical: 14, paddingRight: 8 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  rowText: { flex: 1, gap: 4, paddingTop: 4 },
  actions: { flexDirection: "row" },
  name: { fontSize: 17, fontWeight: "600" },
  meta: { fontSize: 14 },
  track: { height: 8, borderRadius: 4, borderWidth: 1, marginTop: 12, marginRight: 12, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  emptyTitle: { fontSize: 22, fontWeight: "700" },
  emptyText: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22 },
  loading: { textAlign: "center", marginTop: 40, fontSize: 15 },
});
