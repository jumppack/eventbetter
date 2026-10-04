import { planReminders } from "../lib/reminders";

const MAPPING_KEY = "eventbetter.notifications";
const ASKED_KEY = "eventbetter.notificationsAsked";
export const CHANNEL_ID = "reminders";

// Keeps the device's scheduled notifications in line with the subscriptions
// in Calendar. Runs on launch, on returning to the foreground and after every
// create, edit or delete, so a reinstall or new phone recovers by itself.
// The mapping of planned reminder key -> scheduled notification lives in
// storage so unchanged reminders aren't cancelled and rescheduled each time.
export function createNotificationService({ notifications, storage, now = () => new Date() }) {
  let channelReady = false;
  let running = Promise.resolve();

  async function ensureChannel() {
    if (channelReady) return;
    await notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Subscription reminders",
      description: "The day before each numbered event, at 9:00 AM",
      importance: notifications.AndroidImportance.DEFAULT,
    });
    channelReady = true;
  }

  async function readMapping() {
    try {
      return JSON.parse((await storage.getItem(MAPPING_KEY)) ?? "{}");
    } catch {
      return {};
    }
  }

  async function sync(subscriptions) {
    const { granted } = await notifications.getPermissionsAsync();
    if (!granted) return { scheduled: 0, permitted: false };

    await ensureChannel();
    const mapping = await readMapping();
    // Fired or OS-cleared notifications drop out of the scheduled list.
    const live = new Set((await notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier));
    const wanted = new Map(
      planReminders(subscriptions, now()).map((r) => [r.key, { ...r, sig: `${r.fireAt.getTime()}|${r.title}|${r.body}` }]),
    );

    const next = {};
    for (const [key, entry] of Object.entries(mapping)) {
      const want = wanted.get(key);
      if (want && want.sig === entry.sig && live.has(entry.id)) {
        next[key] = entry;
      } else if (live.has(entry.id)) {
        await notifications.cancelScheduledNotificationAsync(entry.id);
      }
    }

    for (const [key, r] of wanted) {
      if (next[key]) continue;
      const id = await notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
      });
      next[key] = { id, sig: r.sig };
    }

    await storage.setItem(MAPPING_KEY, JSON.stringify(next));
    return { scheduled: Object.keys(next).length, permitted: true };
  }

  // Overlapping triggers (focus, foreground, after a save) run one at a time,
  // so two passes never schedule the same reminder twice.
  function queue(fn) {
    const result = running.then(fn, fn);
    running = result.catch(() => {});
    return result;
  }

  async function clear() {
    await notifications.cancelAllScheduledNotificationsAsync();
    await storage.removeItem(MAPPING_KEY);
  }

  return {
    sync: (subscriptions) => queue(() => sync(subscriptions)),
    clear: () => queue(clear),

    getPermission: () => notifications.getPermissionsAsync(),

    // Asked once, after the first subscription is created, not on launch.
    async askOnce() {
      if (await storage.getItem(ASKED_KEY)) return null;
      await storage.setItem(ASKED_KEY, "1");
      const current = await notifications.getPermissionsAsync();
      if (current.granted || !current.canAskAgain) return current;
      return notifications.requestPermissionsAsync();
    },

    request: () => notifications.requestPermissionsAsync(),

    // Development only: check delivery without waiting until 9:00 AM.
    async sendTest(seconds = 10) {
      await ensureChannel();
      return notifications.scheduleNotificationAsync({
        content: { title: "Tuff Gym membership", body: "Tomorrow: Tuff Gym membership: 3rd month over" },
        trigger: { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL_ID },
      });
    },
  };
}
