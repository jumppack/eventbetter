import { createMemoryStorage } from "../../../jest/fakeCalendarApi";
import { normalize } from "../../lib/validate";
import { CHANNEL_ID, createNotificationService } from "../notificationService";

function fakeNotifications({ granted = true, canAskAgain = true } = {}) {
  const scheduled = new Map();
  let nextId = 1;
  const fake = {
    scheduled,
    permission: { granted, canAskAgain, status: granted ? "granted" : "undetermined" },
    channels: [],
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: "date" },
    getPermissionsAsync: jest.fn(async () => fake.permission),
    requestPermissionsAsync: jest.fn(async () => {
      fake.permission = { granted: true, canAskAgain: true, status: "granted" };
      return fake.permission;
    }),
    setNotificationChannelAsync: jest.fn(async (id, channel) => void fake.channels.push({ id, ...channel })),
    scheduleNotificationAsync: jest.fn(async (request) => {
      const id = `n${nextId++}`;
      scheduled.set(id, request);
      return id;
    }),
    cancelScheduledNotificationAsync: jest.fn(async (id) => void scheduled.delete(id)),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => scheduled.clear()),
    getAllScheduledNotificationsAsync: jest.fn(async () =>
      [...scheduled.entries()].map(([identifier, request]) => ({ identifier, ...request })),
    ),
  };
  return fake;
}

const sub = (id, input) => ({ id, name: input.name, editable: true, config: normalize(input) });
const gym = sub("gym", { name: "Tuff Gym membership", start: "2026-09-30" });
const yoga = sub("yoga", { name: "Yoga", start: "2026-10-01", frequency: "weekly" });

function setup(options) {
  const notifications = fakeNotifications(options);
  const storage = createMemoryStorage();
  let current = new Date(2026, 9, 4, 12);
  const service = createNotificationService({ notifications, storage, now: () => current });
  return { notifications, storage, service, setNow: (d) => (current = d) };
}

const bodies = (n) => [...n.scheduled.values()].map((r) => r.content.body).sort();

describe("sync", () => {
  it("schedules the next two reminders per subscription on the reminders channel", async () => {
    const { notifications, service } = setup();
    expect(await service.sync([gym, yoga])).toEqual({ scheduled: 4, permitted: true });

    expect(bodies(notifications)).toEqual([
      "Tomorrow: Tuff Gym membership: 1st month over",
      "Tomorrow: Tuff Gym membership: 2nd month over",
      "Tomorrow: Yoga: 1st week over",
      "Tomorrow: Yoga: 2nd week over",
    ]);
    const [first] = notifications.scheduled.values();
    expect(first.trigger).toMatchObject({ type: "date", channelId: CHANNEL_ID });
    expect(first.trigger.date.getHours()).toBe(9);
    expect(notifications.channels).toHaveLength(1);
  });

  it("leaves unchanged reminders alone on the next sync", async () => {
    const { notifications, service } = setup();
    await service.sync([gym]);
    notifications.scheduleNotificationAsync.mockClear();

    await service.sync([gym]);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(notifications.scheduled.size).toBe(2);
  });

  it("cancels reminders for a deleted subscription", async () => {
    const { notifications, service } = setup();
    await service.sync([gym, yoga]);
    await service.sync([yoga]);
    expect(bodies(notifications)).toEqual(["Tomorrow: Yoga: 1st week over", "Tomorrow: Yoga: 2nd week over"]);
  });

  it("replaces reminders whose text changed after an edit", async () => {
    const { notifications, service } = setup();
    await service.sync([gym]);
    const edited = sub("gym", { name: "Tuff Gym membership", start: "2026-09-30", title: "{name} #{count}" });
    await service.sync([edited]);
    expect(bodies(notifications)).toEqual(["Tomorrow: Tuff Gym membership #1", "Tomorrow: Tuff Gym membership #2"]);
  });

  it("rolls forward once a reminder has fired", async () => {
    const { notifications, service, setNow } = setup();
    await service.sync([gym]);
    // The OS removes a notification from the scheduled list when it fires.
    const [firstId] = notifications.scheduled.keys();
    notifications.scheduled.delete(firstId);
    setNow(new Date(2026, 9, 29, 10));

    await service.sync([gym]);
    expect(bodies(notifications)).toEqual([
      "Tomorrow: Tuff Gym membership: 2nd month over",
      "Tomorrow: Tuff Gym membership: 3rd month over",
    ]);
  });

  it("recovers after a reinstall, when the stored mapping is gone", async () => {
    const { notifications, storage, service } = setup();
    await service.sync([gym]);
    notifications.scheduled.clear();
    await storage.removeItem("eventbetter.notifications");

    await service.sync([gym]);
    expect(notifications.scheduled.size).toBe(2);
  });

  it("does nothing without permission", async () => {
    const { notifications, service } = setup({ granted: false });
    expect(await service.sync([gym])).toEqual({ scheduled: 0, permitted: false });
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("never double-schedules when syncs overlap", async () => {
    const { notifications, service } = setup();
    await Promise.all([service.sync([gym]), service.sync([gym]), service.sync([gym])]);
    expect(notifications.scheduled.size).toBe(2);
  });
});

describe("clear", () => {
  it("cancels everything and forgets the mapping", async () => {
    const { notifications, storage, service } = setup();
    await service.sync([gym]);
    await service.clear();
    expect(notifications.scheduled.size).toBe(0);
    expect(await storage.getItem("eventbetter.notifications")).toBeNull();
  });
});

describe("askOnce", () => {
  it("asks the first time only", async () => {
    const { notifications, service } = setup({ granted: false });
    expect((await service.askOnce()).granted).toBe(true);
    expect(await service.askOnce()).toBeNull();
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("doesn't prompt when the user already said no for good", async () => {
    const { notifications, service } = setup({ granted: false, canAskAgain: false });
    expect((await service.askOnce()).granted).toBe(false);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
