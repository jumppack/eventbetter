import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { createNotificationService } from "./notificationService";

// App-wide instance backed by the real notification and storage modules.
export const reminders = createNotificationService({ notifications: Notifications, storage: AsyncStorage });

// Show reminders that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
