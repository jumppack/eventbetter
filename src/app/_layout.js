import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { SessionProvider, useSession } from "../components/SessionProvider";
import { SubscriptionsProvider } from "../components/SubscriptionsProvider";

function RootStack() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "ready"}>
        <Stack.Screen name="index" />
        <Stack.Screen name="add" />
        <Stack.Screen name="edit/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="licenses" />
      </Stack.Protected>
      <Stack.Protected guard={status === "needsCalendar"}>
        <Stack.Screen name="calendar-access" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <SubscriptionsProvider>
        <RootStack />
      </SubscriptionsProvider>
    </SessionProvider>
  );
}
